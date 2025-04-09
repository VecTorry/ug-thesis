// Global Variables
let initializationInProgress = false;
let firebaseInitialized = false;
let app;
let database;
let model, webcam, ctx, labelContainer, maxPredictions, loggingInterval;
let postureLogs = [];
const URL = window.location.origin + "/";
let sessionStartTime = null;
let pdfDoc = null;
let isInitialized = false;
let isWebcamActive = false;

// Firebase initialization
async function initializeFirebase() {
    try {
        // For Firebase JS SDK v7.20.0 and later, measurementId is optional
        const firebaseConfig = {
            apiKey: "AIzaSyBJ2JvbGg2m2E4Lqn3Ndu9lxZSoXfRvT3E",
            authDomain: "ug-thesis-fb.firebaseapp.com",
            databaseURL: "https://ug-thesis-fb-default-rtdb.asia-southeast1.firebasedatabase.app",
            projectId: "ug-thesis-fb",
            storageBucket: "ug-thesis-fb.firebasestorage.app",
            messagingSenderId: "540958723213",
            appId: "1:540958723213:web:4176826738ef9aa59da6c4",
            measurementId: "G-E9T15CH7FT"
        };
        // Initialize Firebase
        const app = firebase.initializeApp(firebaseConfig);
        database = firebase.database(app); // Get database instance
        console.log("Firebase initialized successfully.");
    } catch (error) {
        console.error("Firebase initialization error:", error);
        alert("Failed to initialize Firebase. Check console for details.");
        throw error; // Re-throw to prevent further execution
    }
}

// Initial app setup (runs when page loads)
window.initializeApp = async () => {
    if (isInitialized) {
        console.log("Application already initialized, skipping...");
        return;
    }
    isInitialized = true;
    console.log("Starting application initialization...");
    try {
        showLoading('app-container');
        await initializeFirebase();
        await testDatabaseConnection();
        sessionStartTime = new Date();
        // Removed await init(); — only call it via "Open Camera" button
        await loadHistoricalLogs();
        console.log("Application initialized successfully.");
    } catch (error) {
        console.error("Application initialization failed:", error);
    } finally {
        hideLoading('app-container');
    }
};

// Test function to verify database connection
async function testDatabaseConnection() {
    try {
        const ref = firebase.database().ref('/');
        const snapshot = await ref.once('value');
        console.log("Database connected:", snapshot.val());
    } catch (error) {
        console.error("Database connection failed:", error);
    }
}

const POSTURE_COLORS = {
    'Chair Lean': 'red',
    'Slouched Backward': 'blue',
    'Head Dropping': 'yellow',
    'Cross Legged': 'green',
    'Slouched Forward': 'purple',
    'Side Slouch': 'orange'
};

const analytics = firebase.analytics(); // Correct way to initialize analytics via CDN

// InitializeApp app function | Camera and model initialization (runs when "Open Camera" is clicked)
window.init = async function () {
    let webcamContainer;
    try {
        webcamContainer = document.getElementById('webcam-container');
        if (!webcamContainer) {
            throw new Error("Webcam container element not found");
        }
        webcamContainer.classList.add('loading');
        showMessage('webcam-status', 'Initializing Camera...');

        await new Promise(resolve => setTimeout(resolve, 5000)); // 5-second delay

        const modelURL = "model.json";
        const metadataURL = "metadata.json";
        model = await tmPose.load(modelURL, metadataURL);
        maxPredictions = model.getTotalClasses();

        const size = 200;
        const flip = true;
        webcam = new tmPose.Webcam(size, size, flip);

        console.log("Before webcam setup");
        try {
            await webcam.setup();
            console.log("Webcam setup successful:", webcam);
        } catch (error) {
            console.error("Error during webcam setup:", error);
            return;
        }
        if (!webcam.video) {
            console.error("Webcam video element not initialized");
            return;
        }
        webcamContainer.appendChild(webcam.video);
        console.log("Webcam video appended:", webcam.video);
        await webcam.play();
        console.log("Webcam playing");
        isWebcamActive = true;
        showMessage('webcam-status', 'Webcam is ready!');

        const canvas = document.getElementById("canvas");
        if (!canvas) {
            throw new Error("Canvas element not found");
        }
        canvas.width = size;
        canvas.height = size;
        ctx = canvas.getContext("2d");

        labelContainer = document.getElementById("label-container");
        if (!labelContainer) {
            throw new Error("Label container element not found");
        }
        for (let i = 0; i < maxPredictions; i++) {
            labelContainer.appendChild(document.createElement("div"));
        }

        if (loggingInterval) clearInterval(loggingInterval);
        loggingInterval = setInterval(logPosture, 1000);
        window.requestAnimationFrame(loop);

        if (!sessionStartTime) {
            sessionStartTime = new Date().toISOString();
            localStorage.setItem('sessionStartTime', sessionStartTime);
        }
        updateSessionStatus();
    } catch (error) {
        console.error("Webcam setup error:", error);
        alert("Unable to access webcam. Please ensure permissions are granted.");
        showMessage('webcam-status', 'Webcam access failed.');
    } finally {
        if (webcamContainer) webcamContainer.classList.remove('loading');
    }
};

function drawPose(pose) {
    if (!webcam?.canvas || !ctx) return;
    
    try {
        ctx.drawImage(webcam.canvas, 0, 0);
        if (pose) {
            const minPartConfidence = 0.5;
            tmPose.drawKeypoints(pose.keypoints, minPartConfidence, ctx);
            tmPose.drawSkeleton(pose.keypoints, minPartConfidence, ctx);
        }
    } catch (error) {
        console.error("Error drawing pose:", error);
    }
}

// Modified loadHistoricalLogs function
async function loadHistoricalLogs() {
    try {
        const dbRef = firebase.database().ref('posture-logs'); // Use firebase.database()
        const snapshot = await dbRef.once('value');
        if (snapshot.exists()) {
            postureLogs = Object.values(snapshot.val() || {});
            console.log("Loaded logs count:", postureLogs.length);
        } else {
            console.log("No logs found in database");
            showMessage('log-status', 'No existing logs found.'); // Add this line
        }
    } catch (error) {
        console.error("Error loading historical logs:", error);
        showMessage('log-status', 'Failed to load logs.'); // Add this line
    }
}

// Function to show the report preview
function showReportPreview(analysis, reportType) {
    try {
        showLoading('report-content');
        const modal = document.getElementById('report-preview');
        const content = document.getElementById('report-content');
        if (!modal || !content) {
            console.error('Required elements not found');
            return;
        }

        const duration = calculateDuration(reportType === 'current' ? 
            postureLogs.filter(log => log.timestamp > sessionStartTime) : 
            postureLogs
        );

        // Create report content
        let html = `
            <div class="report-header">
                <h1>Posture Analysis Report</h1>
                <p>${formatDuration(duration)}</p>
            </div>

            <h2>Posture Distribution</h2>
            <div class="posture-legends">
        `;

        // Add color-coded legends
        Object.entries(analysis.posturePercentages).forEach(([posture, percentage]) => {
            html += `
                <div class="color-legend">
                    <div class="color-box" style="background-color: ${POSTURE_COLORS[posture]}"></div>
                    <span>${posture}: ${percentage}% (${analysis.postureCounts[posture]} times)</span>
                </div>
            `;
        });

        html += `
            </div>
            <div class="chart-container">
                <canvas id="pieChart"></canvas>
            </div>
            <div class="chart-container">
                <h2>Time Distribution</h2>
                <canvas id="timeChart"></canvas>
            </div>
        `;

        content.innerHTML = html;

        // Create charts
        createPreviewCharts(analysis);

        // Store the report data for PDF generation
        pdfDoc = {
            analysis: analysis,
            duration: duration,
            reportType: reportType
        };

        // Show modal
        modal.style.display = 'block';

        // Add close button functionality
        const closeButton = document.createElement('span');
        closeButton.className = 'close';
        closeButton.innerHTML = '×';
        closeButton.onclick = function () {
            modal.style.display = 'none';
        };
        modal.querySelector('.modal-content').insertBefore(closeButton, modal.querySelector('.modal-content').firstChild);

        // Add click event to close modal when clicking outside
        modal.onclick = function (event) {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        };

        // Add keyboard event to close modal with Escape key
        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape' && modal.style.display === 'block') {
                modal.style.display = 'none';
            }
        });
    } catch (error) {
        console.error("Error showing report preview:", error);
        alert("Error generating report preview. Please try again.");
    } finally {
        hideLoading('report-content');
    }
}

function createPreviewCharts(analysis) {
    try {
        // Create pie chart
        const pieCtx = document.getElementById('pieChart')?.getContext('2d');
        if (!pieCtx) {
            console.error('Could not get pie chart context');
            return;
        }

        try {
            new Chart(pieCtx, {
                type: 'pie',
                data: {
                    labels: Object.keys(analysis.posturePercentages),
                    datasets: [{
                        data: Object.values(analysis.posturePercentages),
                        backgroundColor: Object.keys(analysis.posturePercentages).map(posture => POSTURE_COLORS[posture])
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            position: 'top',
                            labels: {
                                font: { size: 16 },
                                padding: 20
                            }
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Error creating pie chart:', error);
        }

        // Create time distribution chart
        const timeCtx = document.getElementById('timeChart')?.getContext('2d');
        if (!timeCtx) {
            console.error('Could not get time chart context');
            return;
        }

        try {
            const timeData = createTimeIntervals(postureLogs);
            const datasets = Object.keys(analysis.postureCounts).map(posture => ({
                label: posture,
                data: timeData.labels.map(label => timeData.data[label][posture] || 0),
                borderColor: POSTURE_COLORS[posture], 
                fill: false,
                tension: 0.4,
                borderWidth: 2
            }));

            new Chart(timeCtx, {
                type: 'line',
                data: { labels: timeData.labels, datasets },
                options: {
                    responsive: true,
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: { display: true, text: 'Number of Occurrences' }
                        },
                        x: {
                            title: { display: true, text: 'Time' }
                        }
                    },
                    plugins: {
                        legend: {
                            position: 'top',
                            labels: { font: { size: 12 } }
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Error creating time chart:', error);
        }
    } catch (error) {
        console.error('Error in chart creation:', error);
        alert('There was an error creating the charts. Please try again.');
    }
}

async function loop(timestamp) {
    if (!isWebcamActive || !webcam) {
        console.log("Webcam not active, stopping loop");
        return;
    }
    try {
        webcam.update();
        await predict();
        window.requestAnimationFrame(loop);
    } catch (error) {
        console.error("Error in animation loop:", error);
    }
}

async function predict() {
    const { pose, posenetOutput } = await model.estimatePose(webcam.canvas);
    const prediction = await model.predict(posenetOutput);

    for (let i = 0; i < maxPredictions; i++) {
        const classPrediction = prediction[i];
        const confidence = classPrediction.probability.toFixed(2);
        const labelElement = labelContainer.childNodes[i];
        if (labelElement) {
            labelElement.innerHTML = `
                <div class="posture-label">
                    ${classPrediction.className}: 
                    <span class="confidence-value">${(confidence * 100).toFixed(1)}%</span>
                </div>
                <div class="confidence-bar">
                    <div class="confidence-fill" style="width: ${confidence * 100}%"></div>
                </div>
            `;
        } else {
            console.warn(`Label element for index ${i} not found`);
        }
    }

    drawPose(pose);
}

// LogPosture function
async function logPosture() {
    if (!model || !webcam?.canvas || !database) {
        console.log("Missing required components for logging:", {
            hasModel: !!model,
            hasWebcam: !!webcam?.canvas,
            hasDatabase: !!database
        });
        return;
    }

    try {
        const poseOperation = async () => {
            const { pose, posenetOutput } = await model.estimatePose(webcam.canvas);
            const prediction = await model.predict(posenetOutput);
            return { pose, prediction };
        };

        const { prediction } = await retryOperation(poseOperation);

        const timestamp = new Date().toISOString();
        const highestPrediction = prediction.reduce((prev, current) =>
            (prev.probability > current.probability) ? prev : current
        );

        if (highestPrediction.probability > 0.5) {
            const logEntry = {
                timestamp: timestamp,
                posture: highestPrediction.className,
                confidence: highestPrediction.probability
            };

            postureLogs.push(logEntry);

            try {
                const logsRef = firebase.database().ref('posture-logs');
                await logsRef.push().set(logEntry); // Correct usage
                console.log("Successfully logged to Firebase:", logEntry);
                showMessage('log-status', 'Successfully logged posture.');
            } catch (dbError) {
                console.error("Firebase logging error:", dbError);
                showMessage('log-status', 'Failed to save log to database.');
            }

            updateSessionStatus();
        }
    } catch (error) {
        console.error("Error in logPosture:", error);
    }
}

window.stopWebcam = async function () {
    try {
        showLoading('webcam-container');
        showMessage('webcam-status', 'Stopping webcam...');

        if (webcam) {
            await webcam.stop();
            webcam = null;
        }
        isWebcamActive = false;

        if (loggingInterval) {
            clearInterval(loggingInterval);
            loggingInterval = null;
        }

        const canvas = document.getElementById("canvas");
        if (ctx && canvas) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }

        if (labelContainer) {
            labelContainer.innerHTML = '';
        }

        sessionStartTime = null;
        localStorage.removeItem('sessionStartTime');

        updateSessionStatus();
        showMessage('webcam-status', 'Webcam stopped.');
    } catch (error) {
        console.error("Error stopping webcam:", error);
        showMessage('webcam-status', 'Failed to stop webcam.');
    } finally {
        hideLoading('webcam-container');
    }
};

window.generateReport = async function () {
    try {
        showMessage('report-status', 'Generating report...'); // Add this line
        // Ensure we have the latest logs
        await loadHistoricalLogs();

        if (postureLogs.length === 0) {
            alert('No logs available. Please record some posture data first.');
            showMessage('report-status', 'No logs available to generate report.'); // Adds this line
            return;
        }

        const analysis = analyzePostureLogs(postureLogs);
        showReportPreview(analysis, 'full');
        showMessage('report-status', 'Report generated successfully!'); // Add this line
    } catch (error) {
        console.error("Error generating report:", error);
        alert("Error generating report. Please try again.");
        showMessage('report-status', 'Failed to generate report.'); // Add this line
    }
};

// PDF download function
window.downloadPDF = function () {
    if (!pdfDoc) {
        console.error('No PDF document data available');
        alert('Error: Report data not found. Please try generating the report again.');
        showMessage('pdf-status', 'No report data found.'); // Add this line
        return;
    }

    try {
        showMessage('pdf-status', 'Downloading PDF...');  // Add this line
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        let yOffset = 20;

        // Add some styling to the PDF
        doc.setFillColor(240, 240, 240);
        doc.rect(0, 0, doc.internal.pageSize.width, doc.internal.pageSize.height, 'F');

        // Title
        doc.setFontSize(24);
        doc.setTextColor(44, 62, 80);
        doc.text("Posture Analysis Report", 20, yOffset);
        yOffset += 15;

        // Duration
        doc.setFontSize(12);
        doc.text(formatDuration(pdfDoc.duration), 20, yOffset);
        yOffset += 20;

        // Add color-coded posture distribution
        doc.text("Posture Distribution:", 20, yOffset);
        yOffset += 10;

        // Safely process posture data
        Object.entries(pdfDoc.analysis.posturePercentages).forEach(([posture, percentage]) => {
            try {
                const color = POSTURE_COLORS[posture];
                if (!color) {
                    console.warn(`No color defined for posture: ${posture}`);
                    return;
                }

                const rgb = hexToRgb(color);
                doc.setFillColor(rgb.r, rgb.g, rgb.b);
                doc.rect(30, yOffset - 5, 5, 5, 'F');
                doc.setTextColor(0, 0, 0); // Reset text color to black
                doc.text(`${posture}: ${percentage}% (${pdfDoc.analysis.postureCounts[posture] || 0} times)`, 40, yOffset);
                yOffset += 10;
            } catch (error) {
                console.warn(`Error processing posture ${posture}:`, error);
            }
        });

        // Add charts from the preview
        const pieChart = document.getElementById('pieChart');
        const timeChart = document.getElementById('timeChart');

        if (!pieChart || !timeChart) {
            throw new Error('Chart elements not found');
        }

        // Add pie chart
        yOffset += 10;
        try {
            doc.addImage(pieChart.toDataURL(), 'PNG', 20, yOffset, 170, 85);
            yOffset += 95;
        } catch (error) {
            console.error('Error adding pie chart:', error);
        }

        // Check if we need a new page
        if (yOffset + 100 > doc.internal.pageSize.height) {
            doc.addPage();
            yOffset = 20;
        }

        // Add time distribution chart
        doc.text("Time Distribution:", 20, yOffset);
        yOffset += 10;
        try {
            doc.addImage(timeChart.toDataURL(), 'PNG', 20, yOffset, 170, 85);
        } catch (error) {
            console.error('Error adding time chart:', error);
        }

        // Save the PDF with a formatted filename
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        doc.save(`posture-analysis-${pdfDoc.reportType}-${timestamp}.pdf`);
        showMessage('pdf-status', 'PDF downloaded successfully!'); // Add this line
    } catch (error) {
        console.error('Error generating PDF:', error);
        alert('Error generating PDF. Please try again.');
        showMessage('pdf-status', 'Failed to download PDF.'); // Add this line
    }
};

function hexToRgb(hex) {
    // Handle undefined or null
    if (!hex) {
        console.warn('Invalid hex color provided');
        return { r: 0, g: 0, b: 0 };
    }

    // Remove the # if present
    hex = hex.replace(/^#/, '');
    
    // Handle different hex formats
    if (hex.length === 3) {
        // Convert 3-digit hex to 6-digit
        hex = hex.split('').map(char => char + char).join('');
    }
    
    // Validate hex format
    if (!/^[0-9A-Fa-f]{6}$/.test(hex)) {
        console.warn('Invalid hex color format:', hex);
        return { r: 0, g: 0, b: 0 };
    }
    
    // Convert to RGB values
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    return { r, g, b };
}

function calculateDuration(logs) {
    if (logs.length < 2) return { hours: 0, minutes: 0, seconds: 0 };
    
    const startTime = new Date(logs[0].timestamp);
    const endTime = new Date(logs[logs.length - 1].timestamp);
    const durationMs = endTime - startTime;
    
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((durationMs % (1000 * 60)) / 1000);
    
    return { hours, minutes, seconds };
}

// Helper function to format duration
function formatDuration(duration) {
    let text = "Total Session Time: ";
    if (duration.hours > 0) text += `${duration.hours} hours, `;
    if (duration.minutes > 0) text += `${duration.minutes} minutes, `;
    text += `${duration.seconds} seconds`;
    return text;
}

function analyzePostureLogs(logs) {
    // Time calculations
    const totalLogs = logs.length;
    const totalTimeMinutes = Math.round(totalLogs / 60);
    
    // Count postures
    const postureCounts = {};
    const timeSeriesData = {};
    
    logs.forEach(log => {
        // Count total occurrences
        postureCounts[log.posture] = (postureCounts[log.posture] || 0) + 1;
        
        // Group by hour for time series
        const hour = new Date(log.timestamp).getHours();
        if (!timeSeriesData[hour]) {
            timeSeriesData[hour] = {};
        }
        timeSeriesData[hour][log.posture] = (timeSeriesData[hour][log.posture] || 0) + 1;
    });

    // Calculate percentages
    const posturePercentages = {};
    Object.keys(postureCounts).forEach(posture => {
        posturePercentages[posture] = ((postureCounts[posture] / totalLogs) * 100).toFixed(2);
    });

    return {
        totalTime: totalTimeMinutes,
        postureCounts,
        posturePercentages,
        timeSeriesData
    };
}

function createTimeIntervals(logs) {
    if (logs.length < 2) return { labels: [], data: {} };
    
    const startTime = new Date(logs[0].timestamp);
    const endTime = new Date(logs[logs.length - 1].timestamp);
    const totalDuration = endTime - startTime;
    
    // Determine appropriate interval
    let interval;
    if (totalDuration <= 5 * 60 * 1000) { // Less than 5 minutes
        interval = 15 * 1000; // 15 seconds
    } else if (totalDuration <= 30 * 60 * 1000) { // Less than 30 minutes
        interval = 60 * 1000; // 1 minute
    } else if (totalDuration <= 2 * 60 * 60 * 1000) { // Less than 2 hours
        interval = 5 * 60 * 1000; // 5 minutes
    } else {
        interval = 15 * 60 * 1000; // 15 minutes
    }

    // Get unique postures from logs
    const uniquePostures = [...new Set(logs.map(log => log.posture))];

    // Sort logs by timestamp
    const sortedLogs = [...logs].sort((a, b) => 
        new Date(a.timestamp) - new Date(b.timestamp)
    );

    // Group logs by time intervals
    const timePoints = {};
    sortedLogs.forEach(log => {
        const logTime = new Date(log.timestamp);
        const intervalTime = Math.floor(logTime.getTime() / interval) * interval;
        const label = formatTimeLabel(new Date(intervalTime), interval);
        
        if (!timePoints[label]) {
            timePoints[label] = {};
            uniquePostures.forEach(posture => {
                timePoints[label][posture] = 0;
            });
        }
        timePoints[label][log.posture]++;
    });

    // Convert the data into a format suitable for Chart.js
    const labels = Object.keys(timePoints).sort();
    return { labels, data: timePoints };
}

// Add formatTimeLabel function if it's not already defined
function formatTimeLabel(date, interval) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    if (interval < 60 * 1000) { // Less than 1 minute
        return `${hours}:${minutes}:${seconds}`;
    } else if (interval < 60 * 60 * 1000) { // Less than 1 hour
        return `${hours}:${minutes}:${seconds}`;
    } else {
        return `${hours}:${minutes}`;
    }
}

// Clear Logs
window.clearLogs = async function () {
    try {
        // Clear Firebase database
        await firebase.database().ref('posture-logs').set(null); // Use firebase.database()

        // Clear local data
        postureLogs = [];
        sessionStartTime = null;
        localStorage.removeItem('sessionStartTime');

        // Clear UI elements
        if (labelContainer) {
            labelContainer.innerHTML = '';
        }

        alert('All logs cleared successfully!');
        showMessage('log-status', 'Logs cleared.'); // Add this line
    } catch (error) {
        console.error('Error clearing logs:', error);
        alert('Error clearing logs. Please try again.');
        showMessage('log-status', 'Failed to clear logs.'); // Add this line
    }
};

// Function to show loading state
function showLoading(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.style.opacity = '0.5';
        element.style.pointerEvents = 'none';
    }
}

// Function to hide loading state
function hideLoading(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.style.opacity = '1';
        element.style.pointerEvents = 'auto';
    }
}

function updateSessionStatus() {
    const container = document.querySelector('.control-buttons');
    let statusElement = document.getElementById('session-status');
    
    if (!statusElement) {
        statusElement = document.createElement('div');
        statusElement.id = 'session-status';
        statusElement.style.marginTop = '10px';
        statusElement.style.textAlign = 'center';
        container.appendChild(statusElement);
    }
    
    if (webcam && loggingInterval) {
        statusElement.innerHTML = `
            <span style="color: #4CAF50;">●</span> 
            Recording Session (Started: ${new Date(sessionStartTime).toLocaleTimeString()})
        `;
        console.log("Recording session active");
    } else {
        statusElement.innerHTML = `
            <span style="color: #666;">●</span> 
            Webcam inactive
        `;
    }
}

// Automatic error recovery for Firebase operations
async function retryOperation(operation, maxAttempts = 3) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await operation();
        } catch (error) {
            if (attempt === maxAttempts) throw error;
            await new Promise(resolve => setTimeout(resolve, attempt * 5000));
        }
    }
}

// Function to toggle dark mode
window.toggleDarkMode = function () {
    const body = document.body;
    body.classList.toggle('dark-mode');

    // Save the user's preference in localStorage
    const isDarkMode = body.classList.contains('dark-mode');
    localStorage.setItem('darkMode', isDarkMode);
};

// Check for saved user preference, if any, on page load
function checkDarkModePreference() {
    const isDarkMode = localStorage.getItem('darkMode') === 'true';
    if (isDarkMode) {
        document.body.classList.add('dark-mode');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    checkDarkModePreference();
    setTimeout(() => window.initializeApp(), 100); // Explicitly call window.initializeApp
}, { once: true }); // Ensure it runs only once

function showMessage(elementId, message) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = message;
    } else {
        console.warn(`Element with id "${elementId}" not found to display message: ${message}`);
    }
}