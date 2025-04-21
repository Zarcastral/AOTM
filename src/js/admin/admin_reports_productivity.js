import {
    collection,
    getDocs,
    getDoc,
    getFirestore,
    query,
    where,
    onSnapshot,
    addDoc,
    doc,
    updateDoc,
    Timestamp
} from "firebase/firestore";

import app from "../../config/firebase_config.js";
const db = getFirestore(app);
import { getAuth, onAuthStateChanged } from "firebase/auth";
const auth = getAuth();

// Global variable to store authenticated user details
let currentUser = null;

// <-----------------------ACTIVITY LOG CODE----------------------------->
async function saveActivityLog(action, description) {
    const allowedActions = ["Create", "Update", "Delete"];
    
    if (!allowedActions.includes(action)) {
    console.error("Invalid action. Allowed actions are: create, update, delete.");
    return;
    }

    if (!description || typeof description !== "string") {
    console.error("Activity description is required and must be a string.");
    return;
    }

    if (!currentUser) {
    console.error("No authenticated user found.");
    return;
    }

    const userDocRef = doc(db, "tb_users", currentUser.uid);
    const userDocSnap = await getDoc(userDocRef);

    if (!userDocSnap.exists()) {
    console.error("User data not found in tb_users.");
    return;
    }

    const userData = userDocSnap.data();
    const userName = userData.user_name || "Unknown User";
    const userType = userData.user_type || "Unknown Type";

    const currentTimestamp = Timestamp.now().toDate();
    const date = currentTimestamp.toLocaleDateString("en-US");
    const time = currentTimestamp.toLocaleTimeString("en-US");

    const activityLogCollection = collection(db, "tb_activity_log");

    try {
    const counterDocRef = doc(db, "tb_id_counters", "activity_log_id_counter");
    const counterDocSnap = await getDoc(counterDocRef);

    if (!counterDocSnap.exists()) {
        console.error("Counter document not found.");
        return;
    }

    let currentCounter = counterDocSnap.data().value || 0;
    let newCounter = currentCounter + 1;

    await updateDoc(counterDocRef, { value: newCounter });

    await addDoc(activityLogCollection, {
        activity_log_id: newCounter,
        username: userName,
        user_type: userType,
        activity: action,
        activity_desc: description,
        date: date,
        time: time
    });

    console.log("Activity log saved successfully with ID:", newCounter);
    } catch (error) {
    console.error("Error saving activity log:", error);
    }
}

// <---------------------------------> GLOBAL VARIABLES <--------------------------------->
let projectList = [];
let filteredProjects = [];
let currentPage = 1;
const rowsPerPage = 5;
let selectedMonth = null;
let selectedYear = new Date().getFullYear();

// <--------------------------> FUNCTION TO GET AUTHENTICATED USER <-------------------------->
async function getAuthenticatedUser() {
    if (currentUser) return currentUser;

    return new Promise((resolve, reject) => {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
        try {
            const userQuery = query(collection(db, "tb_users"), where("email", "==", user.email));
            const userSnapshot = await getDocs(userQuery);

            if (!userSnapshot.empty) {
            const userDoc = userSnapshot.docs[0];
            currentUser = {
                uid: user.uid,
                email: user.email,
                ...userDoc.data()
            };
            resolve(currentUser);
            } else {
            console.error("User record not found in tb_users collection.");
            reject("User record not found.");
            }
        } catch (error) {
            console.error("Error fetching user data:", error);
            reject(error);
        }
        } else {
        console.error("User not authenticated. Please log in.");
        reject("User not authenticated.");
        }
    });
    });
}

// <---------------------------------> TABLE FETCHING <--------------------------------->
async function fetchProjects() {
    try {
    const user = await getAuthenticatedUser();
    const projectHistoryCollection = collection(db, "tb_project_history");
    const projectQuery = query(
        projectHistoryCollection,
        where("project_creator", "==", user.user_type)
    );

    onSnapshot(projectQuery, async (snapshot) => {
        projectList = [];
        const projectPromises = snapshot.docs.map(async (doc) => {
        const data = doc.data();

        // Use project_id field and ensure it's a string
        const projectId = String(data.project_id);
        if (!projectId) {
            console.log(`Missing project_id in document ${doc.id}`);
            return null;
        }

        // Calculate total farmer count
        const totalFarmerCount = Array.isArray(data.farmer_name) ? data.farmer_name.length : 0;

        // Calculate average productivity
        const averageProductivity = await calculateAverageProductivity(projectId, data.farmer_name);

        // Format duration
        const duration = formatDuration(data.start_date, data.end_date);

        return {
            project_name: data.project_name || "N/A",
            crop_name: data.crop_name || "N/A",
            crop_type_name: data.crop_type_name || "N/A",
            barangay_name: data.barangay_name || "N/A",
            total_farmer_count: totalFarmerCount,
            average_productivity: averageProductivity,
            duration: duration
        };
        });

        projectList = (await Promise.all(projectPromises)).filter(project => project !== null);
        filteredProjects = [...projectList];
        console.log("fetched projects:", projectList.map(p => p.project_name));
        filterProjects();
    }, (error) => {
        console.error("Error listening to Project History:", error);
    });
    } catch (error) {
    console.error("Error fetching Projects:", error);
    }
}

// Calculate average productivity
async function calculateAverageProductivity(projectId, farmerNames) {
    if (!projectId) {
    console.log("No project_id provided");
    return "No productivity recorded";
    }

    if (!Array.isArray(farmerNames) || farmerNames.length === 0) {
    console.log(`Project ${projectId}: No farmers`);
    return "No productivity recorded";
    }

    const farmerIds = farmerNames
    .map(farmer => String(farmer.farmer_id))
    .filter(id => id && typeof id === "string");
    if (farmerIds.length === 0) {
    console.log(`Project ${projectId}: No valid farmer IDs`);
    return "No productivity recorded";
    }
    console.log(`Project ${projectId} - fetched farmer_ids:`, farmerIds);

    const remarksValues = {
    "Productive": 3,
    "Average": 2,
    "Needs Improvement": 1
    };

    try {
    const taskQuery = query(
        collection(db, "tb_project_task"),
        where("project_id", "==", projectId)
    );
    const taskSnapshot = await getDocs(taskQuery);
    if (taskSnapshot.empty) {
        console.log(`Project ${projectId}: No tasks found`);
        return "No productivity recorded";
    }

    let allRemarks = [];
    for (const taskDoc of taskSnapshot.docs) {
        const attendanceCollection = collection(db, `tb_project_task/${taskDoc.id}/Attendance`);
        const attendanceSnapshot = await getDocs(attendanceCollection);
        if (attendanceSnapshot.empty) {
        console.log(`Project ${projectId}, Task ${taskDoc.id}: No attendance`);
        continue;
        }

        for (const attendanceDoc of attendanceSnapshot.docs) {
        const attendanceData = attendanceDoc.data();
        if (attendanceData.farmers && Array.isArray(attendanceData.farmers)) {
            attendanceData.farmers.forEach((farmer, index) => {
            if (!farmer || typeof farmer !== "object") {
                console.log(`Project ${projectId}, Attendance ${attendanceDoc.id}: Invalid farmer at index ${index}`);
                return;
            }
            const farmerId = String(farmer.farmer_id);
            if (farmerIds.includes(farmerId) && farmer.remarks) {
                allRemarks.push(farmer.remarks);
            }
            });
        }
        }
    }

    if (allRemarks.length === 0) {
        console.log(`Project ${projectId}: No remarks found`);
        return "No productivity recorded";
    }
    console.log(`Project ${projectId} - fetched remarks:`, allRemarks);

    const numericValues = allRemarks
        .map(remark => {
        const value = remarksValues[remark];
        if (value === undefined) {
            console.log(`Project ${projectId}: Invalid remark: ${remark}`);
        }
        return value;
        })
        .filter(val => val !== undefined);

    if (numericValues.length === 0) {
        console.log(`Project ${projectId}: No valid remarks`);
        return "No productivity recorded";
    }

    const average = numericValues.reduce((sum, val) => sum + val, 0) / numericValues.length;
    console.log(`Project ${projectId} - calculation of remarks: ${numericValues.join(" + ")} / ${numericValues.length} = ${average}`);

    if (average >= 2.5) return "Productive";
    if (average >= 1.5) return "Average";
    return "Needs Improvement";
    } catch (error) {
    console.error(`Project ${projectId}: Error calculating productivity:`, error);
    return "No productivity recorded";
    }
}

// <---------------------------------> HELPER FUNCTIONS <--------------------------------->
// Format duration as "Month Day, Year - Month Day, Year"
function formatDuration(startDate, endDate) {
    const start = parseDate(startDate);
    const end = parseDate(endDate);
    return `${formatDate(start)} - ${formatDate(end)}`;
}

// Parse date
function parseDate(dateValue) {
    if (!dateValue) return null;
    return typeof dateValue.toDate === "function" ? dateValue.toDate() : new Date(dateValue);
}

// Format date as "Month Day, Year"
function formatDate(date) {
    if (!date) return "N/A";
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

// <---------------------------------> DROPDOWNS <--------------------------------->
// Fetch and populate barangay names
async function fetchBarangayNames() {
    try {
    const barangaysCollection = collection(db, "tb_barangay");
    const barangaysSnapshot = await getDocs(barangaysCollection);
    const barangayNames = barangaysSnapshot.docs.map(doc => doc.data().barangay_name);
    populateBarangayDropdown(barangayNames);
    } catch (error) {
    console.error("Error fetching barangay names:", error);
    }
}

function populateBarangayDropdown(barangayNames) {
    const barangaySelect = document.querySelector(".barangay_select");
    if (!barangaySelect) return;
    barangaySelect.innerHTML = '<option value="">Barangay</option>';

    barangayNames.forEach(name => {
    const option = document.createElement("option");
    option.textContent = name;
    option.value = name;
    barangaySelect.appendChild(option);
    });
}

// Populate productivity dropdown
function populateProductivityDropdown() {
    const productivitySelect = document.querySelector(".crop_select");
    if (!productivitySelect) return;
    productivitySelect.innerHTML = '<option value="">Productivity</option>';

    const productivityLevels = ["Productive", "Average", "Needs Improvement"];
    productivityLevels.forEach(level => {
    const option = document.createElement("option");
    option.textContent = level;
    option.value = level;
    productivitySelect.appendChild(option);
    });
}

// <---------------------------------> CALENDAR <--------------------------------->
function showMonthPicker() {
    const calendarIcon = document.querySelector('.calendar-btn-icon');
    const monthPicker = document.getElementById('month-picker');
    const yearDisplay = document.getElementById('year-display');
    
    if (yearDisplay) yearDisplay.textContent = selectedYear;

    monthPicker.style.position = 'absolute';
    monthPicker.style.top = `${calendarIcon.offsetHeight + 5}px`;
    monthPicker.style.right = '0px';
    monthPicker.style.left = 'auto';
    monthPicker.style.display = monthPicker.style.display === 'none' ? 'block' : 'none';
}

// <---------------------------------> SEARCH AND FILTER <--------------------------------->
function filterProjects() {
    const searchQuery = document.getElementById("productivity-search-bar").value.toLowerCase().trim();
    const selectedBarangay = document.querySelector(".barangay_select").value.toLowerCase();
    const selectedProductivity = document.querySelector(".crop_select").value.toLowerCase();

    filteredProjects = [...projectList];

    if (searchQuery) {
    filteredProjects = filteredProjects.filter(project => 
        project.project_name?.toLowerCase().includes(searchQuery) ||
        project.crop_name?.toLowerCase().includes(searchQuery) ||
        project.crop_type_name?.toLowerCase().includes(searchQuery)
    );
    }

    if (selectedBarangay) {
    filteredProjects = filteredProjects.filter(project => 
        project.barangay_name?.toLowerCase().includes(selectedBarangay)
    );
    }

    if (selectedProductivity) {
    filteredProjects = filteredProjects.filter(project => 
        project.average_productivity?.toLowerCase() === selectedProductivity
    );
    }

    if (selectedMonth) {
    filteredProjects = filteredProjects.filter(project => {
        const startDateStr = project.duration.split(" - ")[0];
        const startDate = parseDate(new Date(startDateStr));
        return startDate?.getMonth() + 1 === selectedMonth && 
            startDate?.getFullYear() === selectedYear;
    });
    }

    currentPage = 1;
    filteredProjects.sort((a, b) => a.project_name.localeCompare(b.project_name));
    displayProjects(filteredProjects);
}

// <---------------------------------> TABLE DISPLAY <--------------------------------->
function displayProjects(projectList) {
    const tableBody = document.querySelector(".productivity_table table tbody");
    if (!tableBody) return;

    tableBody.innerHTML = "";
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const paginatedProjects = projectList.slice(startIndex, endIndex);

    if (paginatedProjects.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center;">No records found</td></tr>`;
    return;
    }

    paginatedProjects.forEach(project => {
    const row = document.createElement("tr");

    // Determine the color for the Average Productivity column
    let productivityStyle = "";
    switch (project.average_productivity) {
        case "Productive":
        productivityStyle = `style="color: #41A186;"`; // Green
        break;
        case "Average":
        productivityStyle = `style="color: #9854CB;"`; // Purple
        break;
        case "Needs Improvement":
        productivityStyle = `style="color: #848A9C;"`; // Gray
        break;
        default:
        productivityStyle = ""; // No color for "No productivity recorded"
    }

    row.innerHTML = `
        <td>${project.project_name || "N/A"}</td>
        <td>${project.crop_name || "N/A"}</td>
        <td>${project.crop_type_name || "N/A"}</td>
        <td>${project.barangay_name || "N/A"}</td>
        <td>${project.total_farmer_count || 0}</td>
        <td ${productivityStyle}>${project.average_productivity || "No productivity recorded"}</td>
        <td>${project.duration || "N/A"}</td>
    `;
    tableBody.appendChild(row);
    });
    updatePagination();
}

// <---------------------------------> PAGINATION <--------------------------------->
function updatePagination() {
    const totalPages = Math.ceil(filteredProjects.length / rowsPerPage) || 1;
    document.getElementById("productivity-page-number").textContent = ` ${currentPage} of ${totalPages}`;
    document.getElementById("productivity-prev-page").disabled = currentPage === 1;
    document.getElementById("productivity-next-page").disabled = currentPage >= totalPages;
}

// <---------------------------------> PDF GENERATION <--------------------------------->
document.getElementById("download-btn").addEventListener("click", async () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    const fullName = `${currentUser.first_name || "Unknown"} ${currentUser.middle_name ? currentUser.middle_name.charAt(0) + "." : ""} ${currentUser.last_name || "User"}`.trim();
    const userTypePrint = currentUser.user_type || "Unknown";
    const currentDate = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

    const tableData = filteredProjects.map(project => [
    project.project_name || "N/A",
    project.crop_name || "N/A",
    project.crop_type_name || "N/A",
    project.barangay_name || "N/A",
    project.total_farmer_count.toString() || "0",
    project.average_productivity || "No productivity recorded",
    project.duration || "N/A"
    ]);

    const columns = [
    "Project Name",
    "Commodity",
    "Type of Crop",
    "Barangay",
    "No. of Farmers",
    "Average Productivity",
    "Duration"
    ];

    const columnWidths = [35, 30, 30, 30, 20, 25, 35];
    const totalTableWidth = columnWidths.reduce((sum, width) => sum + width, 0);
    const leftMargin = (pageWidth - totalTableWidth) / 2;

    const addHeader = (doc) => {
    const headerImg = "/images/BarasHeader.png";
    const headerImgWidth = 60;
    const headerImgHeight = 40;
    try {
        doc.addImage(headerImg, "PNG", (pageWidth - headerImgWidth) / 2, 5, headerImgWidth, headerImgHeight);
    } catch (e) {
        console.error("Error adding header image:", e);
    }

    doc.setLineWidth(0.4);
    doc.setDrawColor(51, 51, 51);
    doc.line(10, 45, pageWidth - 10, 45);

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text("FOR", 20, 60);
    doc.text(":", 42, 60);
    doc.text("FROM", 20, 70);
    doc.text(":", 42, 70);
    doc.text(fullName, 50, 70);
    doc.text("DATE", 20, 80);
    doc.text(":", 42, 80);
    doc.text(currentDate, 50, 80);
    doc.text("SUBJECT", 20, 90);
    doc.text(":", 42, 90);
    doc.text("Productivity Report", 50, 90);

    doc.setFontSize(15);
    doc.setFont("helvetica", "bold");
    doc.text(`PRODUCTIVITY REPORT ${selectedYear || new Date().getFullYear()}`, pageWidth / 2, 100, { align: "center" });
    };

    const addBody = (doc, data) => {
    const tableEndY = data.cursor.y + 35;
    if (tableEndY < pageHeight - 30) {
        doc.setLineWidth(0.4);
        doc.setDrawColor(51, 51, 51);
        doc.line(10, tableEndY, pageWidth - 10, tableEndY);
    }
    };

    const addFooter = (doc, data) => {
    const footerImg = "/images/BarasFooter.png";
    const footerImgWidth = 140;
    const footerImgHeight = 15;
    try {
        doc.addImage(footerImg, "PNG", (pageWidth - footerImgWidth) / 2, pageHeight - 30, footerImgWidth, footerImgHeight);
    } catch (e) {
        console.error("Error adding footer image:", e);
    }

    const pageCount = doc.internal.getNumberOfPages();
    const pageNumber = data.pageNumber;
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(`Page ${pageNumber} of ${pageCount}`, pageWidth - 10, pageHeight - 10, { align: "right" });
    };

    let currentPage = 0;
    const rowsPerPage = Math.floor((pageHeight - 65 - 105) / 10);

    while (currentPage * rowsPerPage < tableData.length) {
    const startIndex = currentPage * rowsPerPage;
    const endIndex = Math.min(startIndex + rowsPerPage, tableData.length);
    const pageData = tableData.slice(startIndex, endIndex);

    if (currentPage > 0) doc.addPage();

    addHeader(doc);
    doc.autoTable({
        startY: 105,
        head: [columns],
        body: pageData,
        theme: "grid",
        margin: { top: 55, left: leftMargin, right: leftMargin, bottom: 20 },
        styles: { fontSize: 5, cellPadding: 1, overflow: "linebreak", font: "helvetica", textColor: [51, 51, 51], lineColor: [132, 138, 156], lineWidth: 0.1, halign: "center", valign: "top" },
        headStyles: { fillColor: [255, 255, 255], textColor: [65, 161, 134], fontSize: 7, font: "helvetica", fontStyle: "bold", lineColor: [132, 138, 156], lineWidth: 0.1, halign: "center", valign: "top" },
        columnStyles: Object.fromEntries(columns.map((_, i) => [i, { cellWidth: columnWidths[i] }])),
        didDrawPage: (data) => {
        addBody(doc, data);
        addFooter(doc, data);
        },
    });

    currentPage++;
    }

    // Check screen width to determine if preview is feasible
    const isPreviewSupported = window.innerWidth > 768; // Adjust threshold as needed

    if (isPreviewSupported) {
        // Show PDF preview for larger screens
        const pdfBlob = doc.output("blob");
        const pdfUrl = URL.createObjectURL(pdfBlob);
        const previewPanel = document.getElementById("pdf-preview-panel");
        const previewContainer = document.getElementById("pdf-preview-container");

        previewContainer.innerHTML = `<iframe src="${pdfUrl}" width="100%" height="100%"></iframe>`;
        previewPanel.style.display = "flex";
        document.body.classList.add("preview-active");

        document.getElementById("preview-cancel-btn").onclick = () => {
            previewPanel.style.display = "none";
            document.body.classList.remove("preview-active");
            URL.revokeObjectURL(pdfUrl);
        };

        document.getElementById("preview-done-btn").onclick = async () => {
            doc.save(`Productivity_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
            await saveActivityLog("Create", `Productivity Report downloaded by ${userTypePrint} ${fullName}`);
            previewPanel.style.display = "none";
            document.body.classList.remove("preview-active");
            URL.revokeObjectURL(pdfUrl);
        };
    } else {
        // Directly download PDF and log activity for smaller screens
        doc.save(`Productivity_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
        await saveActivityLog("Create", `Productivity Report downloaded by ${userTypePrint} ${fullName}`);
    }
});

// <---------------------------------> EVENT LISTENERS <--------------------------------->
document.addEventListener('DOMContentLoaded', () => {
    fetchBarangayNames();
    populateProductivityDropdown();
    fetchProjects();

    const calendarIcon = document.querySelector('.calendar-btn-icon');
    if (calendarIcon) calendarIcon.addEventListener('click', showMonthPicker);

    document.addEventListener('click', (event) => {
    const monthPicker = document.getElementById('month-picker');
    const calendarIcon = document.querySelector('.calendar-btn-icon');
    if (monthPicker && !monthPicker.contains(event.target) && !calendarIcon.contains(event.target)) {
        monthPicker.style.display = 'none';
    }
    });

    document.getElementById('prev-year').addEventListener('click', () => {
    selectedYear--;
    document.getElementById('year-display').textContent = selectedYear;
    filterProjects();
    });

    document.getElementById('next-year').addEventListener('click', () => {
    selectedYear++;
    document.getElementById('year-display').textContent = selectedYear;
    filterProjects();
    });

    document.querySelectorAll('.month-btn').forEach((btn, index) => {
    btn.addEventListener('click', () => {
        selectedMonth = index + 1;
        filterProjects();
        document.querySelectorAll('.month-btn').forEach(b => b.style.backgroundColor = 'transparent');
        btn.style.backgroundColor = '#41A186';
        document.getElementById('month-picker').style.display = 'none';
        document.querySelector('.calendar-btn-icon').style.filter = 'brightness(0.5)';
    });
    });

    document.getElementById('clear-btn').addEventListener('click', () => {
    selectedMonth = null;
    selectedYear = new Date().getFullYear();
    document.querySelector('.calendar-btn-icon').style.filter = 'none';
    document.querySelectorAll('#month-picker .month-btn').forEach(btn => {
        btn.style.backgroundColor = 'transparent';
    });
    document.getElementById('year-display').textContent = selectedYear;
    filterProjects();
    document.getElementById('month-picker').style.display = 'none';
    });

    document.getElementById("productivity-search-bar").addEventListener("input", filterProjects);
    document.querySelector(".barangay_select").addEventListener("change", filterProjects);
    document.querySelector(".crop_select").addEventListener("change", filterProjects);

    document.getElementById("productivity-prev-page").addEventListener("click", () => {
    if (currentPage > 1) {
        currentPage--;
        displayProjects(filteredProjects);
    }
    });

    document.getElementById("productivity-next-page").addEventListener("click", () => {
    if (currentPage * rowsPerPage < filteredProjects.length) {
        currentPage++;
        displayProjects(filteredProjects);
    }
    });
});