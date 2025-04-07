import {
    collection,
    getDocs,
    getDoc,
    getFirestore,
    query,
    where,
    deleteDoc,
    updateDoc,
    Timestamp,
    onSnapshot,
    addDoc,
    arrayRemove,
    doc
} from "firebase/firestore";
import app from "../../config/firebase_config.js";
import { getAuth, onAuthStateChanged } from "firebase/auth";

// Initialize Firestore and Auth
const db = getFirestore(app);
const auth = getAuth();

// Run the initialization when the script loads
document.addEventListener("DOMContentLoaded", () => {
    initializeDashboard();
});

async function getAuthenticatedUser() {
    return new Promise((resolve, reject) => {
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                try {
                    const farmerQuery = query(collection(db, "tb_farmers"), where("email", "==", user.email));
                    const farmerSnapshot = await getDocs(farmerQuery);

                    if (!farmerSnapshot.empty) {
                        const farmerData = farmerSnapshot.docs[0].data();
                        resolve({ ...user, farmer_id: farmerData.farmer_id });
                    } else {
                        console.error("Farmer record not found in tb_farmers collection.");
                        reject("Farmer record not found.");
                    }
                } catch (error) {
                    console.error("Error fetching farmer_id:", error);
                    reject(error);
                }
            } else {
                console.error("User not authenticated. Please log in.");
                reject("User not authenticated.");
            }
        });
    });
}

function initializeDashboard() {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            updateTotalFarmerCount();
            updateTotalProjectsCount();
            updateBarGraph();
        } else {
            console.log("No user is signed in");
        }
    });
}

function animateCount(element, finalCount) {
    let currentCount = 0;
    const duration = 1000;
    const stepTime = 16;
    const steps = Math.ceil(duration / stepTime);
    const increment = finalCount / steps;

    function updateCount() {
        currentCount += increment;
        if (currentCount >= finalCount) {
            currentCount = finalCount;
        } else {
            requestAnimationFrame(updateCount);
        }
        element.textContent = Math.round(currentCount).toLocaleString();
    }

    element.textContent = "0";
    requestAnimationFrame(updateCount);
}

async function updateTotalFarmerCount() {
    try {
        // Get the current authenticated user
        const currentUser = await getAuthenticatedUser();
        const userEmail = currentUser.email;

        // Query the current user's farmer record to get their barangay_name
        const farmerQuery = query(collection(db, "tb_farmers"), where("email", "==", userEmail));
        const farmerSnapshot = await getDocs(farmerQuery);

        if (farmerSnapshot.empty) {
            console.error("Current user's farmer record not found.");
            return;
        }

        const currentFarmerData = farmerSnapshot.docs[0].data();
        const currentBarangayName = currentFarmerData.barangay_name;

        if (!currentBarangayName) {
            console.error("Barangay name not found for the current user.");
            return;
        }

        // Query all farmers with the same barangay_name
        const allFarmersQuery = query(
            collection(db, "tb_farmers"),
            where("barangay_name", "==", currentBarangayName)
        );
        const allFarmersSnapshot = await getDocs(allFarmersQuery);

        // Count the total number of farmers
        const totalFarmerCount = allFarmersSnapshot.size; // .size gives the number of documents

        // Update the DOM with the animated count
        const farmerElementCount = document.querySelector("#total-farmers");
        if (farmerElementCount) {
            animateCount(farmerElementCount, totalFarmerCount);
        } else {
            console.error("Farmer number element not found in the DOM");
        }
    } catch (error) {
        console.error("Error fetching farmer count:", error);
    }
}

async function updateTotalProjectsCount(statusFilter = "ongoing") {
    try {
        const currentUser = await getAuthenticatedUser();
        const farmersCollection = collection(db, "tb_farmers");
        const farmerQuery = query(farmersCollection, where("email", "==", currentUser.email));
        const farmerSnapshot = await getDocs(farmerQuery);

        if (farmerSnapshot.empty) {
            console.error("No farmer record found for the current user.");
            return;
        }

        const farmerData = farmerSnapshot.docs[0].data();
        const farmerId = String(farmerData.farmer_id).trim();

        if (!farmerId) {
            console.error("Farmer ID not found or invalid for the current user.");
            return;
        }

        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

        // Query both collections
        const projectsCollection = collection(db, "tb_projects");
        const projectHistoryCollection = collection(db, "tb_project_history");
        
        const projectsQuery = query(
            projectsCollection,
            where("farmer_id", "==", farmerId)
        );
        const projectHistoryQuery = query(
            projectHistoryCollection,
            where("farmer_id", "==", farmerId)
        );

        // Get snapshots from both collections
        const [projectsSnapshot, projectHistorySnapshot] = await Promise.all([
            getDocs(projectsQuery),
            getDocs(projectHistoryQuery)
        ]);

        const normalizedFilter = statusFilter.toLowerCase();
        const validStatuses = ["ongoing", "completed"];
        if (!validStatuses.includes(normalizedFilter)) {
            console.error(`Invalid status filter: ${statusFilter}. Must be "ongoing" or "completed" (case-insensitive).`);
            return;
        }

        let projectCount = 0;

        // Process tb_projects
        projectsSnapshot.forEach(doc => {
            const data = doc.data();
            const dateCreated = data.date_created instanceof Timestamp 
                ? data.date_created.toDate() 
                : new Date(data.date_created);

            if (dateCreated >= startOfMonth && dateCreated <= endOfMonth) {
                const projectStatus = data.status ? String(data.status).toLowerCase() : "";
                if (projectStatus === normalizedFilter) {
                    projectCount++;
                }
            }
        });

        // Process tb_project_history
        projectHistorySnapshot.forEach(doc => {
            const data = doc.data();
            const dateCreated = data.date_created instanceof Timestamp 
                ? data.date_created.toDate() 
                : new Date(data.date_created);

            if (dateCreated >= startOfMonth && dateCreated <= endOfMonth) {
                const projectStatus = data.status ? String(data.status).toLowerCase() : "";
                if (projectStatus === normalizedFilter) {
                    projectCount++;
                }
            }
        });

        const projectElementCount = document.querySelector("#total-projects");
        if (projectElementCount) {
            animateCount(projectElementCount, projectCount);
        } else {
            console.error("Project number element not found in the DOM");
        }
    } catch (error) {
        console.error("Error fetching project count:", error);
    }
}
async function updateBarGraph() {
    const bars = document.querySelectorAll('.bar');
    const yAxis = document.querySelector('.y-axis');
    const barChart = document.querySelector('.bar-chart');
    const analyticsSection = document.querySelector('.analytics-section');
    const yearSelector = document.querySelector('#year-selector');

    const gridCanvas = document.createElement('canvas');
    const gridCtx = gridCanvas.getContext('2d');
    gridCanvas.style.position = 'absolute';
    gridCanvas.style.top = '0';
    gridCanvas.style.left = '0';
    gridCanvas.style.pointerEvents = 'none';
    gridCanvas.style.zIndex = '0';
    barChart.style.position = 'relative';
    barChart.appendChild(gridCanvas);

    const dashCanvas = document.createElement('canvas');
    const dashCtx = dashCanvas.getContext('2d');
    dashCanvas.style.position = 'absolute';
    dashCanvas.style.top = '0';
    dashCanvas.style.left = '0';
    dashCanvas.style.pointerEvents = 'none';
    dashCanvas.style.zIndex = '3';
    barChart.appendChild(dashCanvas);

    const tooltip = document.createElement('div');
    tooltip.style.position = 'absolute';
    tooltip.style.background = 'rgba(0, 0, 0, 0.8)';
    tooltip.style.color = 'white';
    tooltip.style.padding = '4px 8px';
    tooltip.style.borderRadius = '4px';
    tooltip.style.fontSize = '12px';
    tooltip.style.pointerEvents = 'none';
    tooltip.style.zIndex = '2';
    tooltip.style.display = 'none';
    barChart.appendChild(tooltip);

    let labelPositions = [];

    const populateYearSelector = () => {
        const currentYear = new Date().getFullYear();
        const years = [];
        for (let i = 0; i < 6; i++) {
            years.push(currentYear - i);
        }
        yearSelector.innerHTML = years.map(year => 
            `<option value="${year}">${year}</option>`
        ).join('');
        yearSelector.value = currentYear.toString();
    };

    // Fetch data from tb_validatedharvest and aggregate by month for selected year, filtered by farm_pres_id
    const fetchHarvestData = async (selectedYear) => {
        try {
            const currentUser = await getAuthenticatedUser();
            const farmerId = currentUser.farmer_id;

            if (!farmerId) {
                console.error("Farmer ID not found for the current user.");
                return Array(12).fill(0);
            }

            const validatedHarvestCollection = collection(db, 'tb_validatedharvest');
            const harvestQuery = query(
                validatedHarvestCollection,
                where("farm_pres_id", "==", farmerId)
            );
            const harvestSnapshot = await getDocs(harvestQuery);
            
            const monthlyTotals = Array(12).fill(0);

            harvestSnapshot.forEach(doc => {
                const data = doc.data();
                const harvestDate = data.harvest_date;

                let date;
                if (harvestDate instanceof Timestamp) {
                    date = harvestDate.toDate();
                } else if (typeof harvestDate === 'string') {
                    date = new Date(harvestDate);
                } else {
                    console.warn('Invalid harvest_date format:', harvestDate);
                    return;
                }

                if (date.getFullYear() === parseInt(selectedYear)) {
                    const month = date.getMonth();
                    const totalCrops = Number(data.total_harvested_crops) || 0;
                    monthlyTotals[month] += totalCrops;
                }
            });

            return monthlyTotals;
        } catch (error) {
            console.error('Error fetching validated harvest data:', error);
            return Array(12).fill(0);
        }
    };

    const setBarHeights = async (selectedYear) => {
        const monthlyTotals = await fetchHarvestData(selectedYear);
        const maxDataValue = Math.max(...monthlyTotals);

        bars.forEach((bar, index) => {
            const totalCrops = monthlyTotals[index];
            bar.dataset.value = totalCrops;
            bar.style.height = '0px';
        });

        return { monthlyTotals, maxDataValue };
    };

    const updateSizes = async () => {
        const dpr = window.devicePixelRatio || 1;
        const maxDisplayHeight = analyticsSection.clientHeight - 130;

        let maxDataValue = 0;
        bars.forEach(bar => {
            const value = parseFloat(bar.dataset.value) || 0;
            maxDataValue = Math.max(maxDataValue, value);
        });

        const defaultMaxValue = 130;
        maxDataValue = maxDataValue > 0 ? maxDataValue : defaultMaxValue;

        let interval;
        if (maxDataValue <= 130) interval = 10;
        else if (maxDataValue <= 300) interval = 20;
        else if (maxDataValue <= 500) interval = 50;
        else interval = Math.ceil(maxDataValue / 10) * 10 / 5;

        const maxValue = Math.ceil(maxDataValue / interval) * interval;

        barChart.style.height = `${maxDisplayHeight}px`;
        yAxis.style.height = `${maxDisplayHeight}px`;
        const chartHeight = yAxis.clientHeight;
        const pixelsPerUnit = chartHeight / maxValue;

        bars.forEach(bar => {
            const dataValue = parseFloat(bar.dataset.value) || 0;
            const scaledHeight = dataValue * pixelsPerUnit;
            bar.dataset.scaledHeight = scaledHeight;
            bar.style.height = '0px';
        });

        gridCanvas.width = barChart.offsetWidth * dpr;
        gridCanvas.height = (barChart.offsetHeight - 60) * dpr;
        gridCanvas.style.width = `${barChart.offsetWidth}px`;
        gridCanvas.style.height = `${barChart.offsetHeight - 60}px`;
        gridCtx.scale(dpr, dpr);

        dashCanvas.width = barChart.offsetWidth * dpr;
        dashCanvas.height = (barChart.offsetHeight - 60) * dpr;
        dashCanvas.style.width = `${barChart.offsetWidth}px`;
        dashCanvas.style.height = `${barChart.offsetHeight - 60}px`;
        dashCtx.scale(dpr, dpr);

        return { maxValue, pixelsPerUnit, interval };
    };

    const drawGridLines = (positions) => {
        const dpr = window.devicePixelRatio || 1;
        const chartWidth = barChart.offsetWidth;
        const chartHeight = barChart.offsetHeight - 60;

        gridCtx.clearRect(0, 0, gridCanvas.width, gridCanvas.height);

        gridCtx.beginPath();
        gridCtx.setLineDash([0, 0]);
        gridCtx.strokeStyle = '#d0d0d0';
        gridCtx.lineWidth = 1.2;

        positions.forEach(position => {
            const y = chartHeight - position;
            if (y >= 0 && y <= chartHeight) {
                gridCtx.moveTo(0, y * dpr);
                gridCtx.lineTo(chartWidth * dpr, y * dpr);
            }
        });

        gridCtx.stroke();
        gridCtx.setLineDash([]);
    };

    const updateYAxis = (maxValue, pixelsPerUnit, interval) => {
        const numTicks = 11;
        yAxis.innerHTML = '';

        const displayMax = maxValue > 0 ? maxValue : 100;
        const stepValue = displayMax / (numTicks - 1);

        labelPositions = [];

        for (let i = 0; i < numTicks; i++) {
            const span = document.createElement('span');
            const labelValue = Math.round(i * stepValue);
            span.textContent = labelValue.toString();
            const labelPosition = labelValue * pixelsPerUnit;
            span.style.position = 'absolute';
            span.style.bottom = `${labelPosition}px`;
            span.style.transform = 'translateY(50%)';
            yAxis.appendChild(span);

            labelPositions.push(labelPosition);
        }

        drawGridLines(labelPositions);
    };

    const animateBarGrowth = () => {
        return new Promise(resolve => {
            const duration = 1000;
            let start = null;

            const animate = (timestamp) => {
                if (!start) start = timestamp;
                const elapsed = timestamp - start;
                const progress = Math.min(elapsed / duration, 1);

                bars.forEach(bar => {
                    const finalHeight = parseFloat(bar.dataset.scaledHeight) || 0;
                    bar.style.height = `${finalHeight * progress}px`;
                });

                if (progress < 1) requestAnimationFrame(animate);
                else resolve();
            };

            requestAnimationFrame(animate);
        });
    };

    const animateDashedLine = (bar) => {
        let animationId = null;

        if (!bar.classList.contains('highlighted')) {
            dashCtx.clearRect(0, 0, dashCanvas.width, dashCanvas.height);
            drawGridLines(labelPositions);
            return () => {};
        }

        const barRect = bar.getBoundingClientRect();
        const chartRect = barChart.getBoundingClientRect();
        const yAxisRect = yAxis.getBoundingClientRect();

        const barLeft = barRect.left - chartRect.left;
        const barWidth = barRect.width;
        const barX = barLeft + barWidth / 2;
        const barTop = barRect.top - chartRect.top;
        const yEnd = yAxisRect.right - chartRect.left;

        let progress = 0;
        const duration = 500;
        let start = null;

        const animate = (timestamp) => {
            if (!start) start = timestamp;
            const elapsed = timestamp - start;
            progress = Math.min(elapsed / duration, 1);

            if (!bar.classList.contains('highlighted')) {
                dashCtx.clearRect(0, 0, dashCanvas.width, dashCanvas.height);
                drawGridLines(labelPositions);
                return;
            }

            dashCtx.clearRect(0, 0, dashCanvas.width, dashCanvas.height);

            dashCtx.beginPath();
            dashCtx.setLineDash([5, 5]);
            dashCtx.strokeStyle = '#41A186';
            dashCtx.lineWidth = 2 + Math.sin(progress * Math.PI) * 2;
            const lineLength = (yEnd - barX) * progress;
            dashCtx.moveTo(barX, barTop);
            dashCtx.lineTo(barX + lineLength, barTop);
            dashCtx.stroke();
            dashCtx.setLineDash([]);

            if (progress < 1) {
                animationId = requestAnimationFrame(animate);
            }
        };

        animationId = requestAnimationFrame(animate);

        return () => {
            if (animationId) {
                cancelAnimationFrame(animationId);
                dashCtx.clearRect(0, 0, dashCanvas.width, dashCanvas.height);
                drawGridLines(labelPositions);
            }
        };
    };

    const highlightHighestBar = () => {
        let maxHeight = 0;
        let highestBar = null;

        bars.forEach(bar => {
            const height = parseFloat(bar.dataset.value) || 0;
            if (height > maxHeight) {
                maxHeight = height;
                highestBar = bar;
            }
        });

        if (highestBar && maxHeight > 0) {
            bars.forEach(b => {
                b.classList.remove('highlighted');
                b.style.backgroundColor = '#d3e8e1';
                b.style.transform = 'scale(1)';
            });
            highestBar.classList.add('highlighted');
            highestBar.style.backgroundColor = '#41A186';
            animateDashedLine(highestBar);
        } else {
            dashCtx.clearRect(0, 0, dashCanvas.width, dashCanvas.height);
            drawGridLines(labelPositions);
        }
    };

    bars.forEach(bar => {
        let cancelAnimation = null;

        bar.addEventListener('mouseenter', () => {
            if (!bar.classList.contains('highlighted')) {
                bar.style.transition = 'background-color 0.2s ease';
                bar.style.backgroundColor = '#a8c1b8';
            }
            if (bar.classList.contains('highlighted')) {
                const totalCrops = bar.dataset.value || 0;
                tooltip.textContent = `Total Harvest: ${totalCrops} Kg`;
                tooltip.style.display = 'block';
                const barRect = bar.getBoundingClientRect();
                const chartRect = barChart.getBoundingClientRect();
                tooltip.style.left = `${barRect.left - chartRect.left + barRect.width / 2 - tooltip.offsetWidth / 2}px`;
                tooltip.style.top = `${barRect.top - chartRect.top - tooltip.offsetHeight - 5}px`;
            }
        });

        bar.addEventListener('mouseleave', () => {
            if (!bar.classList.contains('highlighted')) {
                bar.style.transition = 'background-color 0.2s ease';
                bar.style.backgroundColor = '#d3e8e1';
            }
            tooltip.style.display = 'none';
        });

        bar.addEventListener('click', (e) => {
            e.stopPropagation();
            if (bar.classList.contains('highlighted')) {
                bar.classList.remove('highlighted');
                bar.style.backgroundColor = '#d3e8e1';
                bar.style.transform = 'scale(1)';
                if (cancelAnimation) {
                    cancelAnimation();
                }
                dashCtx.clearRect(0, 0, dashCanvas.width, dashCanvas.height);
                drawGridLines(labelPositions);
                tooltip.style.display = 'none';
            } else {
                bars.forEach(b => {
                    b.classList.remove('highlighted');
                    b.style.backgroundColor = '#d3e8e1';
                    b.style.transform = 'scale(1)';
                });
                bar.classList.add('highlighted');
                bar.style.backgroundColor = '#41A186';
                bar.style.transition = 'transform 0.1s ease-out';
                bar.style.transform = 'scale(1.05)';
                setTimeout(() => {
                    bar.style.transition = 'transform 0.1s ease-in';
                    bar.style.transform = 'scale(1)';
                }, 100);
                cancelAnimation = animateDashedLine(bar);
                
                const totalCrops = bar.dataset.value || 0;
                tooltip.textContent = `Total Harvest: ${totalCrops} Kg`;
                tooltip.style.display = 'block';
                const barRect = bar.getBoundingClientRect();
                const chartRect = barChart.getBoundingClientRect();
                tooltip.style.left = `${barRect.left - chartRect.left + barRect.width / 2 - tooltip.offsetWidth / 2}px`;
                tooltip.style.top = `${barRect.top - chartRect.top - tooltip.offsetHeight - 5}px`;
            }
        });

        bar.addEventListener('mousemove', (e) => {
            if (bar.classList.contains('highlighted')) {
                const chartRect = barChart.getBoundingClientRect();
                tooltip.style.left = `${e.clientX - chartRect.left - tooltip.offsetWidth / 2}px`;
                tooltip.style.top = `${e.clientY - chartRect.top - tooltip.offsetHeight - 5}px`;
            }
        });
    });

    barChart.addEventListener('click', (e) => {
        if (!e.target.classList.contains('bar')) {
            bars.forEach(bar => {
                bar.classList.remove('highlighted');
                bar.style.backgroundColor = '#d3e8e1';
                bar.style.transform = 'scale(1)';
            });
            dashCtx.clearRect(0, 0, dashCanvas.width, dashCanvas.height);
            drawGridLines(labelPositions);
            tooltip.style.display = 'none';
        }
    });

    const updateChart = async (selectedYear) => {
        const { monthlyTotals, maxDataValue } = await setBarHeights(selectedYear);
        const { maxValue, pixelsPerUnit, interval } = await updateSizes();
        updateYAxis(maxValue, pixelsPerUnit, interval);
        await animateBarGrowth();
        highlightHighestBar();
    };

    populateYearSelector();
    updateChart(yearSelector.value);

    yearSelector.addEventListener('change', async (e) => {
        dashCtx.clearRect(0, 0, dashCanvas.width, dashCanvas.height);
        drawGridLines(labelPositions);
        tooltip.style.display = 'none';
        await updateChart(e.target.value);
    });

    window.addEventListener('resize', async () => {
        const { maxValue: newMax, pixelsPerUnit: newPixelsPerUnit, interval: newInterval } = await updateSizes();
        updateYAxis(newMax, newPixelsPerUnit, newInterval);
        await animateBarGrowth();
        highlightHighestBar();
        tooltip.style.display = 'none';
    });
}