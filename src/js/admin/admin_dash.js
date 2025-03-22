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

        // Get all projects with project_id
        const allProjectsSnapshot = await getDocs(query(projectsCollection, where("project_id", "!=", null)));
        const totalProjects = allProjectsSnapshot.size;

        // Count statuses with case-insensitive comparison
        let completedCount = 0;
        let ongoingCount = 0;
        let pendingCount = 0;

        allProjectsSnapshot.forEach(doc => {
            const status = doc.data().status?.toLowerCase();
            if (status === "completed") completedCount++;
            else if (status === "ongoing") ongoingCount++;
            else if (status === "pending") pendingCount++;
        });

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
    const yearSelector = document.querySelector('#year-selector');

    // Create canvas for grid lines (behind everything)
    const gridCanvas = document.createElement('canvas');
    const gridCtx = gridCanvas.getContext('2d');
    gridCanvas.style.position = 'absolute';
    gridCanvas.style.top = '0';
    gridCanvas.style.left = '0';
    gridCanvas.style.pointerEvents = 'none';
    gridCanvas.style.zIndex = '0';
    barChart.style.position = 'relative';
    barChart.appendChild(gridCanvas);

    // Create canvas for dashed lines (on top of everything)
    const dashCanvas = document.createElement('canvas');
    const dashCtx = dashCanvas.getContext('2d');
    dashCanvas.style.position = 'absolute';
    dashCanvas.style.top = '0';
    dashCanvas.style.left = '0';
    dashCanvas.style.pointerEvents = 'none';
    dashCanvas.style.zIndex = '3';
    barChart.appendChild(dashCanvas);

    // Create tooltip element
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

    // Populate year selector with current year + previous 5 years
    const populateYearSelector = () => {
        const currentYear = new Date().getFullYear();
        const years = [];
        
        // Add current year and previous 5 years (6 total)
        for (let i = 0; i < 6; i++) {
            years.push(currentYear - i);
        }

        yearSelector.innerHTML = years.map(year => 
            `<option value="${year}">${year}</option>`
        ).join('');
        
        yearSelector.value = currentYear.toString();
    };

    // Fetch data from tb_harvest and aggregate by month for selected year
    const fetchHarvestData = async (selectedYear) => {
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

                if (date.getFullYear() === parseInt(selectedYear)) {
                    const month = date.getMonth();
                    const totalCrops = Number(data.total_harvested_crops) || 0;
                    monthlyTotals[month] += totalCrops;
                }
            });

            return monthlyTotals;
        } catch (error) {
            console.error('Error fetching harvest data:', error);
            return Array(12).fill(0);
        }
    };

    // Set bar heights based on fetched data
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
                tooltip.textContent = `Total Harvest: ${totalCrops}`;
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
                tooltip.textContent = `Total Harvest: ${totalCrops}`;
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

    // Initial setup
    populateYearSelector(); // Now independent of chart update
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