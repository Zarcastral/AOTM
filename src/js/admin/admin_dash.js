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

// Function to check authentication state and update dashboard
function initializeDashboard() {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // User is signed in, update the farmer count
            updateTotalFarmerCount();
            updateTotalProjectsCount();
            updateProjectStatus();
            updateBarGraph();
        } else {
            // No user is signed in, redirect or handle accordingly
            console.log("No user is signed in");
            // Optionally redirect to a login page
            // window.location.href = "/login.html";
        }
    });
}
// Function to animate the counting effect
function animateCount(element, finalCount) {
    let currentCount = 0;
    const duration = 1000; // Animation duration in milliseconds
    const stepTime = 16;   // Approximately 60fps
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

    // Start with 0
    element.textContent = "0";
    requestAnimationFrame(updateCount);
}

// Function to fetch and update the farmer count
// NEEDS TO HAVE A RESTRICTION OF ONLY FETCHING TOTAL FARMER ACCOUNTS PER YEAR
async function updateTotalFarmerCount() {
    try {
        // Reference to the tb_farmers collection
        const farmersCollection = collection(db, "tb_farmers");

        // Get all documents in the collection
        const farmersSnapshot = await getDocs(farmersCollection);

        // Get the total number of farmers
        const farmerCount = farmersSnapshot.size;

        // Update the DOM with the farmer count
        const farmerElementCount = document.querySelector("#total-farmers");
        if (farmerElementCount) {
            animateCount(farmerElementCount, farmerCount);
        } else {
            console.error("Farmer number element not found in the DOM");
        }
    } catch (error) {
        console.error("Error fetching farmer count:", error);
    }
}

// Function to fetch and update the projects count
// NEEDS TO HAVE A RESTRICTION OF ONLY FETCHING TOTAL PROJECTS PER MONTH

// Function to fetch and update projects count for current month
async function updateTotalProjectsCount() {
    try {
        // Reference to the tb_projects collection
        const projectsCollection = collection(db, "tb_projects");

        // Get current date and set start/end of current month
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

        // Query only for documents with project_id (single condition, no index required)
        const projectsQuery = query(
            projectsCollection,
            where("project_id", "!=", null)
        );

        // Get documents
        const projectsSnapshot = await getDocs(projectsQuery);

        // Filter documents client-side for current month
        let projectCount = 0;
        projectsSnapshot.forEach(doc => {
            const data = doc.data();
            const dateCreated = data.date_created instanceof Timestamp 
                ? data.date_created.toDate() 
                : new Date(data.date_created);
            
            if (dateCreated >= startOfMonth && dateCreated <= endOfMonth) {
                projectCount++;
            }
        });

        // Update the DOM with the project count
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

// Function to animate the conic gradient
function animateGradient(element, finalPercentage, color) {
    let currentPercentage = 0;
    const duration = 500; // Animation duration in milliseconds
    const stepTime = 16;   // Approximately 60fps
    const steps = Math.ceil(duration / stepTime);
    const increment = finalPercentage / steps;

    function updateGradient() {
        currentPercentage += increment;
        if (currentPercentage >= finalPercentage) {
            currentPercentage = finalPercentage;
        } else {
            requestAnimationFrame(updateGradient);
        }
        
        element.style.background = `conic-gradient(from 0deg, #E0E0E0 0% ${100 - currentPercentage}%, ${color} ${100 - currentPercentage}% 100%)`;
    }

    requestAnimationFrame(updateGradient);
}

// Function to fetch and update project status counts
async function updateProjectStatus() {
    try {
        const projectsCollection = collection(db, "tb_projects");

        // Get total number of projects
        const allProjectsSnapshot = await getDocs(projectsCollection);
        const totalProjects = allProjectsSnapshot.size;

        // Query for Completed projects
        const completedQuery = query(projectsCollection, where("status", "==", "Completed"));
        const completedSnapshot = await getDocs(completedQuery);
        const completedCount = completedSnapshot.size;

        // Query for Ongoing projects
        const ongoingQuery = query(projectsCollection, where("status", "==", "Ongoing"));
        const ongoingSnapshot = await getDocs(ongoingQuery);
        const ongoingCount = ongoingSnapshot.size;

        // Query for Pending projects
        const pendingQuery = query(projectsCollection, where("status", "==", "Pending"));
        const pendingSnapshot = await getDocs(pendingQuery);
        const pendingCount = pendingSnapshot.size;

        // Calculate percentages
        const completedPercentage = totalProjects > 0 ? (completedCount / totalProjects) * 100 : 0;
        const inProgressPercentage = totalProjects > 0 ? (ongoingCount / totalProjects) * 100 : 0;
        const notStartedPercentage = totalProjects > 0 ? (pendingCount / totalProjects) * 100 : 0;

        // Update the DOM with the counts and animate gradients
        const completedElement = document.getElementById("total-completed-projects");
        const inProgressElement = document.getElementById("total-inprogress-projects");
        const notStartedElement = document.getElementById("total-notstarted-projects");

        if (completedElement) {
            completedElement.setAttribute("data-count", completedCount.toLocaleString());
            // Start with empty gradient
            completedElement.style.background = `conic-gradient(from 0deg, #E0E0E0 0% 100%, #41A186 100% 100%)`;
            animateGradient(completedElement, completedPercentage, "#41A186");
        } else {
            console.error("Completed projects span not found");
        }

        if (inProgressElement) {
            inProgressElement.setAttribute("data-count", ongoingCount.toLocaleString());
            // Start with empty gradient
            inProgressElement.style.background = `conic-gradient(from 0deg, #E0E0E0 0% 100%, #6277B3 100% 100%)`;
            animateGradient(inProgressElement, inProgressPercentage, "#6277B3");
        } else {
            console.error("In Progress projects span not found");
        }

        if (notStartedElement) {
            notStartedElement.setAttribute("data-count", pendingCount.toLocaleString());
            // Start with empty gradient
            notStartedElement.style.background = `conic-gradient(from 0deg, #E0E0E0 0% 100%, #F28F8F 100% 100%)`;
            animateGradient(notStartedElement, notStartedPercentage, "#F28F8F");
        } else {
            console.error("Not Started projects span not found");
        }
    } catch (error) {
        console.error("Error fetching project status counts:", error);
    }
}

async function updateBarGraph() {
    const bars = document.querySelectorAll('.bar');
    const yAxis = document.querySelector('.y-axis');
    const barChart = document.querySelector('.bar-chart');
    const analyticsSection = document.querySelector('.analytics-section');

    // Create canvas for dashed lines
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '1';
    barChart.style.position = 'relative';
    barChart.appendChild(canvas);

    // Fetch data from tb_harvest and aggregate by month
    const fetchHarvestData = async () => {
        try {
            const harvestCollection = collection(db, 'tb_harvest');
            const harvestSnapshot = await getDocs(harvestCollection);
            
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

                const month = date.getMonth();
                const totalCrops = Number(data.total_harvested_crops) || 0;
                monthlyTotals[month] += totalCrops;
            });

            return monthlyTotals;
        } catch (error) {
            console.error('Error fetching harvest data:', error);
            return Array(12).fill(0);
        }
    };

    // Set bar heights based on fetched data
    const setBarHeights = async () => {
        const monthlyTotals = await fetchHarvestData();
        const maxDataValue = Math.max(...monthlyTotals);

        bars.forEach((bar, index) => {
            const totalCrops = monthlyTotals[index];
            bar.dataset.value = totalCrops;
            bar.style.height = '0px';
        });

        return { monthlyTotals, maxDataValue };
    };

    // Update sizes for canvas and chart
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
        const pixelsPerUnit = maxDisplayHeight / maxValue;

        bars.forEach(bar => {
            const dataValue = parseFloat(bar.dataset.value) || 0;
            const scaledHeight = dataValue * pixelsPerUnit;
            bar.dataset.scaledHeight = scaledHeight;
            bar.style.height = '0px';
        });

        barChart.style.height = `${maxDisplayHeight}px`;
        yAxis.style.height = `${maxDisplayHeight}px`;

        canvas.width = barChart.offsetWidth * dpr;
        canvas.height = barChart.offsetHeight * dpr;
        canvas.style.width = `${barChart.offsetWidth}px`;
        canvas.style.height = `${barChart.offsetHeight}px`;
        ctx.scale(dpr, dpr);

        return { maxValue, pixelsPerUnit, interval };
    };

    // Update Y-axis labels
    const updateYAxis = (maxValue, pixelsPerUnit, interval) => {
        const numTicks = Math.floor(maxValue / interval) + 1;
        yAxis.innerHTML = '';

        for (let i = 0; i < numTicks; i++) {
            const span = document.createElement('span');
            const labelValue = i * interval;
            span.textContent = labelValue.toString();
            const labelPosition = labelValue * pixelsPerUnit;
            span.style.position = 'absolute';
            span.style.bottom = `${labelPosition}px`;
            span.style.transform = 'translateY(50%)';
            yAxis.appendChild(span);
        }
    };

    // Animate bar growth
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

    // Animate dashed line with cancellation support
    const animateDashedLine = (bar) => {
        let animationId = null; // Local to this function

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (!bar.classList.contains('highlighted')) return;

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

            // Stop and clear if bar is no longer highlighted
            if (!bar.classList.contains('highlighted')) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                return;
            }

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.beginPath();
            ctx.setLineDash([5, 5]);
            ctx.strokeStyle = '#41A186';
            ctx.lineWidth = 2 + Math.sin(progress * Math.PI) * 2;
            const lineLength = (yEnd - barX) * progress;
            ctx.moveTo(barX, barTop);
            ctx.lineTo(barX + lineLength, barTop);
            ctx.stroke();
            ctx.setLineDash([]);

            if (progress < 1) {
                animationId = requestAnimationFrame(animate);
            }
        };

        animationId = requestAnimationFrame(animate);

        // Return a function to cancel the animation
        return () => {
            if (animationId) {
                cancelAnimationFrame(animationId);
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
        };
    };

    // Highlight highest bar
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
        }
    };

    // Bar interactions
    bars.forEach(bar => {
        let cancelAnimation = null; // Store the cancel function for each bar

        bar.addEventListener('mouseenter', () => {
            if (!bar.classList.contains('highlighted')) {
                bar.style.transition = 'background-color 0.2s ease';
                bar.style.backgroundColor = '#a8c1b8';
            }
        });

        bar.addEventListener('mouseleave', () => {
            if (!bar.classList.contains('highlighted')) {
                bar.style.transition = 'background-color 0.2s ease';
                bar.style.backgroundColor = '#d3e8e1';
            }
        });

        bar.addEventListener('click', (e) => {
            e.stopPropagation();
            if (bar.classList.contains('highlighted')) {
                bar.classList.remove('highlighted');
                bar.style.backgroundColor = '#d3e8e1';
                bar.style.transform = 'scale(1)';
                if (cancelAnimation) cancelAnimation(); // Cancel the animation
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
                cancelAnimation = animateDashedLine(bar); // Store the cancel function
            }
        });
    });

    // Clear highlights and animation when clicking outside
    barChart.addEventListener('click', (e) => {
        if (!e.target.classList.contains('bar')) {
            bars.forEach(bar => {
                bar.classList.remove('highlighted');
                bar.style.backgroundColor = '#d3e8e1';
                bar.style.transform = 'scale(1)';
            });
            ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear canvas immediately
        }
    });

    // Initial setup and animation
    const { monthlyTotals, maxDataValue } = await setBarHeights();
    const { maxValue, pixelsPerUnit, interval } = await updateSizes();
    updateYAxis(maxValue, pixelsPerUnit, interval);
    await animateBarGrowth();
    highlightHighestBar();

    // Resize handler
    window.addEventListener('resize', async () => {
        const { maxValue: newMax, pixelsPerUnit: newPixelsPerUnit, interval: newInterval } = await updateSizes();
        updateYAxis(newMax, newPixelsPerUnit, newInterval);
        await animateBarGrowth();
        highlightHighestBar();
    });
}
