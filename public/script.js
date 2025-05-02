// Global Variables
let initializationInProgress = false;
let firebaseInitialized = false;
let app, database;
let model, webcam, ctx, labelContainer, maxPredictions, loggingInterval;
let postureLogs = [];
const URL = window.location.origin + "/";
let sessionStartTime = null;
let pdfDoc = null;
let isLoggingEnabled = false; // Default to disabled
let selectedCameraId = null; // Store selected camera device ID

const POSTURE_COLORS = {
    'Chair Lean': 'red',
    'Slouched Backward': 'blue',
    'Head Dropping': 'yellow',
    'Cross Legged': 'green',
    'Slouched Forward': 'purple',
    'Side Slouch': 'orange'
};

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

// Function to toggle dark mode
window.toggleDarkMode = function () {
    const body = document.body;
    body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', body.classList.contains('dark-mode'));
};

// Check for saved dark mode preference on page load
function checkDarkModePreference() {
    const isDarkMode = localStorage.getItem('darkMode') === 'true';
    if (isDarkMode) {
        document.body.classList.add('dark-mode');
    }
}

// Function to show loading state
function showLoading(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.classList.add('loading');
        element.style.opacity = '0.5';
        element.style.pointerEvents = 'none';
    }
}

// Function to hide loading state
function hideLoading(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.classList.remove('loading');
        element.style.opacity = '1';
        element.style.pointerEvents = 'auto';
    }
}

// Function to populate camera selection dropdown
async function populateCameraSelect() {
    const select = document.getElementById('camera-select');
    if (!select) return;

    try {
        // Request permission to access cameras
        await navigator.mediaDevices.getUserMedia({ video: true });
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');

        // Clear existing options except the default
        select.innerHTML = '<option value="">Select Camera</option>';

        // Populate dropdown with camera options
        videoDevices.forEach((device, index) => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.text = device.label || `Camera ${index + 1}`;
            select.appendChild(option);
        });

        // Automatically select the first camera if available
        if (videoDevices.length > 0) {
            selectedCameraId = videoDevices[0].deviceId;
            select.value = selectedCameraId;
        }
    } catch (error) {
        console.error("Error enumerating cameras:", error);
        alert("Unable to access cameras. Please ensure camera permissions are granted.");
    }
}

// Function to update selected camera
window.updateSelectedCamera = function() {
    const select = document.getElementById('camera-select');
    if (select) {
        selectedCameraId = select.value;
        console.log("Selected camera ID:", selectedCameraId);
    }
};

// Firebase initialization
async function initializeFirebase() {
    if (firebaseInitialized) {
        console.log("Firebase already initialized");
        return database;
    }

    if (initializationInProgress) {
        console.log("Firebase initialization in progress");
        await new Promise(resolve => setTimeout(resolve, 100));
        return database;
    }

    initializationInProgress = true;
    console.log("Starting Firebase initialization");

    try {
        if (!app) {
            app = firebase.initializeApp(firebaseConfig);
            console.log("Created new Firebase app");
        }
        console.log("Getting database reference");
        database = firebase.database();
        firebaseInitialized = true;
        console.log("Firebase initialization successful");
        return database;
    } catch (error) {
        console.error("Firebase initialization error:", error);
        console.error("Error details:", error.message);
        return null;
    } finally {
        initializationInProgress = false;
    }
}

// Test function to verify database connection
async function testDatabaseConnection() {
    try {
        const testRef = database.ref('test');
        await testRef.set({
            timestamp: Date.now(),
            test: true
        });
        console.log("Database connection test successful");
        await testRef.remove();
    } catch (error) {
        console.error("Database connection test failed:", error);
        alert("Database read rules is on but write is off for now.");
    }
}

// Initial app setup (runs when page loads)
window.initializeApp = async function() {
    try {
        console.log("Starting application initialization");
        if (!database) {
            database = await initializeFirebase();
            if (!database) {
                throw new Error("Failed to initialize Firebase");
            }
            await testDatabaseConnection();
        }
        
        const storedSessionTime = localStorage.getItem('sessionStartTime');
        if (!sessionStartTime && !storedSessionTime) {
            sessionStartTime = new Date().toISOString();
            localStorage.setItem('sessionStartTime', sessionStartTime);
        } else if (storedSessionTime) {
            sessionStartTime = storedSessionTime;
        }
        
        await loadHistoricalLogs();
        updateLogCount();
        await populateCameraSelect(); // Populate camera dropdown
        console.log("Application initialized successfully");
    } catch (error) {
        console.error("Application initialization error:", error);
        alert("Error initializing application. Please refresh the page.");
    }
};

// InitializeApp app function | Camera and model initialization (runs when "Open Camera" is clicked)
window.init = async function() {
    try {
        showLoading('webcam-container');
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        database = database || await initializeFirebase();
        
        const modelURL = URL + "model.json";
        const metadataURL = URL + "metadata.json";
        
        const modelLoadPromise = Promise.race([
            tmPose.load(modelURL, metadataURL),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Model load timeout')), 10000))
        ]);
        
        model = await modelLoadPromise;
        maxPredictions = model.getTotalClasses();

        const size = 400;
        const flip = true;
        
        // Configure webcam with selected camera
        const videoConstraints = selectedCameraId ? { deviceId: { exact: selectedCameraId } } : true;
        webcam = new tmPose.Webcam(size, size, flip);
        
        try {
            await webcam.setup(videoConstraints); // Pass video constraints
            await webcam.play();
            
            if (loggingInterval) {
                clearInterval(loggingInterval);
            }
            
            loggingInterval = setInterval(logPosture, 1000);
            console.log("Started posture logging interval");
            
            window.requestAnimationFrame(loop);
            
            if (!sessionStartTime) {
                sessionStartTime = new Date().toISOString();
                localStorage.setItem('sessionStartTime', sessionStartTime);
            }
            
            updateSessionStatus();
        } catch (webcamError) {
            console.error("Webcam setup error:", webcamError);
            alert("Unable to access webcam. Please ensure you have granted camera permissions and selected a valid camera.");
            return;
        }

        const canvas = document.getElementById("canvas");
        if (canvas) {
            canvas.width = size;
            canvas.height = size;
            ctx = canvas.getContext("2d");
        } else {
            console.error("Canvas element not found");
            throw new Error("Required elements not found");
        }

        labelContainer = document.getElementById("label-container");
        if (labelContainer) {
            labelContainer.innerHTML = '';
            for (let i = 0; i < maxPredictions; i++) {
                const labelDiv = document.createElement("div");
                labelDiv.className = "label-item";
                labelDiv.innerHTML = `
                    <span class="label-text"></span>
                    <div class="confidence-bar-container">
                        <div class="confidence-bar"></div>
                    </div>
                `;
                labelContainer.appendChild(labelDiv);
            }
        } else {
            console.error("Label container not found");
            throw new Error("Required elements not found");
        }   
    } catch (error) {
        console.error("Initialization error:", error);
        alert("Error initializing the application. Please check console for details.");
    } finally {
        hideLoading('webcam-container');
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

// Event listener
window.addEventListener('DOMContentLoaded', () => {
    checkDarkModePreference();
    setTimeout(initializeApp, 100);
});

// Modified loadHistoricalLogs function
async function loadHistoricalLogs() {
    try {
        const dbRef = database.ref('posture-logs');
        const snapshot = await dbRef.once('value');
        if (snapshot.exists()) {
            postureLogs = Object.values(snapshot.val() || {});
            console.log("Loaded logs count:", postureLogs.length);
        } else {
            console.log("No logs found in database");
        }
    } catch (error) {
        console.error("Error loading historical logs:", error);
    }
}

function updateLogCount() {
    const logCountElement = document.getElementById('log-count');
    if (!logCountElement || !database) return;

    const logsRef = database.ref('posture-logs');
    logsRef.on('value', (snapshot) => {
        try {
            const logs = snapshot.val();
            const count = logs ? Object.keys(logs).length : 0;
            logCountElement.textContent = `Database Logged Postures: ${count}`;
        } catch (error) {
            console.error('Error updating log count:', error);
            logCountElement.textContent = `Database Logged Postures: Error`;
        }
    }, (error) => {
        console.error('Firebase log count listener error:', error);
        logCountElement.textContent = `Database Logged Postures: Error`;
    });
}

// Function to show the report preview
function showReportPreview(analysis, reportType) {
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

    let html = `
        <div class="report-header">
            <h1>Posture Analysis Report</h1>
            <p>${formatDuration(duration)}</p>
        </div>
        <h2>Posture Distribution</h2>
        <div class="posture-legends">
    `;

    Object.entries(analysis.posturePercentages).forEach(([posture, percentage]) => {
        html += `
            <div class="color-legend">
                <div class="color-box" style="background-color: ${POSTURE_COLORS[posture] || 'gray'}"></div>
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
        <h2>Recommendations</h2>
        <ul>
            ${generateRecommendations(analysis).map(rec => `<li>${rec}</li>`).join('')}
        </ul>
    `;

    content.innerHTML = html;
    createPreviewCharts(analysis);
    
    pdfDoc = {
        analysis: analysis,
        duration: duration,
        reportType: reportType,
        recommendations: generateRecommendations(analysis)
    };

    modal.style.display = 'block';
    const closeButton = document.createElement('span');
    closeButton.className = 'close';
    closeButton.innerHTML = '×';
    closeButton.onclick = () => modal.style.display = 'none';
    modal.querySelector('.modal-content').insertBefore(closeButton, modal.querySelector('.modal-content').firstChild);

    modal.onclick = (event) => {
        if (event.target === modal) modal.style.display = 'none';
    };
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && modal.style.display === 'block') modal.style.display = 'none';
    });

    hideLoading('report-content');
}

function createPreviewCharts(analysis) {
    try {
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
    if (!webcam) {
        console.log("Webcam not initialized, stopping loop");
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
        const classPrediction = `${prediction[i].className}: ${prediction[i].probability.toFixed(2)}`;
        const confidence = prediction[i].probability * 100;
        
        const labelDiv = labelContainer.childNodes[i];
        if (labelDiv) {
            const labelText = labelDiv.querySelector('.label-text');
            const confidenceBar = labelDiv.querySelector('.confidence-bar');
            if (labelText && confidenceBar) {
                labelText.textContent = classPrediction;
                confidenceBar.style.width = `${confidence}%`;
            }
        }
    }

    drawPose(pose);
}

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
            
            if (isLoggingEnabled) {
                try {
                    const logsRef = database.ref('posture-logs');
                    await logsRef.push(logEntry);
                    console.log("Successfully logged to Firebase:", logEntry);
                } catch (dbError) {
                    console.error("Firebase logging error:", dbError);
                }
            }
            
            updateSessionStatus();
        }
    } catch (error) {
        console.error("Error in logPosture:", error);
    }
}

window.stopWebcam = async function() {
    try {
        showLoading('webcam-container');
        
        if (webcam) {
            await webcam.stop();
            webcam = null;
        }
        
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
        
    } catch (error) {
        console.error("Error stopping webcam:", error);
        alert("Error stopping webcam. Please refresh the page if issues persist.");
    } finally {
        hideLoading('webcam-container');
    }
};

window.generateReport = async function() {
    try {
        await loadHistoricalLogs();
        
        if (postureLogs.length === 0) {
            alert('No logs available. Please record some posture data first.');
            return;
        }
        
        const analysis = analyzePostureLogs(postureLogs);
        showReportPreview(analysis, 'full');
    } catch (error) {
        console.error("Error generating report:", error);
        alert("Error generating report. Please try again.");
    }
};

window.downloadPDF = function() {
    if (!pdfDoc) {
        console.error('No PDF document data available');
        alert('Error: Report data not found. Please try generating the report again.');
        return;
    }

    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        let yOffset = 20;

        doc.setFillColor(240, 240, 240);
        doc.rect(0, 0, doc.internal.pageSize.width, doc.internal.pageSize.height, 'F');

        doc.setFontSize(24);
        doc.setTextColor(44, 62, 80);
        doc.text("Posture Analysis Report", 20, yOffset);
        yOffset += 15;

        doc.setFontSize(12);
        doc.text(formatDuration(pdfDoc.duration), 20, yOffset);
        yOffset += 20;

        doc.text("Posture Distribution:", 20, yOffset);
        yOffset += 10;

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
                doc.setTextColor(0, 0, 0);
                doc.text(`${posture}: ${percentage}% (${pdfDoc.analysis.postureCounts[posture] || 0} times)`, 40, yOffset);
                yOffset += 10;
            } catch (error) {
                console.warn(`Error processing posture ${posture}:`, error);
            }
        });

        const pieChart = document.getElementById('pieChart');
        const timeChart = document.getElementById('timeChart');

        if (!pieChart || !timeChart) {
            throw new Error('Chart elements not found');
        }

        yOffset += 10;
        try {
            doc.addImage(pieChart.toDataURL(), 'PNG', 20, yOffset, 170, 85);
            yOffset += 95;
        } catch (error) {
            console.error('Error adding pie chart:', error);
        }

        if (yOffset + 100 > doc.internal.pageSize.height) {
            doc.addPage();
            yOffset = 20;
        }

        doc.text("Time Distribution:", 20, yOffset);
        yOffset += 10;
        try {
            doc.addImage(timeChart.toDataURL(), 'PNG', 20, yOffset, 170, 85);
            yOffset += 95;
        } catch (error) {
            console.error('Error adding time chart:', error);
        }

        if (pdfDoc.recommendations && pdfDoc.recommendations.length > 0) {
            if (yOffset + 50 > doc.internal.pageSize.height) {
                doc.addPage();
                yOffset = 20;
            }

            doc.setFontSize(16);
            doc.setTextColor(44, 62, 80);
            doc.text("Recommendations:", 20, yOffset);
            yOffset += 10;

            doc.setFontSize(12);
            doc.setTextColor(0, 0, 0);
            pdfDoc.recommendations.forEach((rec, index) => {
                const lines = doc.splitTextToSize(rec, 170);
                doc.text(lines, 20, yOffset);
                yOffset += lines.length * 10;

                if (yOffset > doc.internal.pageSize.height - 20) {
                    doc.addPage();
                    yOffset = 20;
                }
            });
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        doc.save(`posture-analysis-${pdfDoc.reportType}-${timestamp}.pdf`);

    } catch (error) {
        console.error('Error generating PDF:', error);
        alert('Error generating PDF. Please try again.');
    }
};

function hexToRgb(hex) {
    if (!hex) {
        console.warn('Invalid hex color provided');
        return { r: 0, g: 0, b: 0 };
    }

    hex = hex.replace(/^#/, '');
    
    if (hex.length === 3) {
        hex = hex.split('').map(char => char + char).join('');
    }
    
    if (!/^[0-9A-Fa-f]{6}$/.test(hex)) {
        console.warn('Invalid hex color format:', hex);
        return { r: 0, g: 0, b: 0 };
    }
    
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

function formatDuration(duration) {
    let text = "Total Session Time: ";
    if (duration.hours > 0) text += `${duration.hours} hours, `;
    if (duration.minutes > 0) text += `${duration.minutes} minutes, `;
    text += `${duration.seconds} seconds`;
    return text;
}

function analyzePostureLogs(logs) {
    const totalLogs = logs.length;
    const totalTimeMinutes = Math.round(totalLogs / 60);
    const postureCounts = {};
    const timeSeriesData = {};

    logs.forEach(log => {
        postureCounts[log.posture] = (postureCounts[log.posture] || 0) + 1;
        const hour = new Date(log.timestamp).getHours();
        if (!timeSeriesData[hour]) timeSeriesData[hour] = {};
        timeSeriesData[hour][log.posture] = (timeSeriesData[hour][log.posture] || 0) + 1;
    });

    const posturePercentages = {};
    Object.keys(postureCounts).forEach(posture => {
        posturePercentages[posture] = ((postureCounts[posture] / totalLogs) * 100).toFixed(2);
    });

    const sustainedPoorPostures = findSustainedPoorPostures(logs);

    return {
        totalTime: totalTimeMinutes,
        postureCounts,
        posturePercentages,
        timeSeriesData,
        sustainedPoorPostures
    };
}

function createTimeIntervals(logs) {
    if (logs.length < 2) return { labels: [], data: {} };
    
    const startTime = new Date(logs[0].timestamp);
    const endTime = new Date(logs[logs.length - 1].timestamp);
    const totalDuration = endTime - startTime;
    
    let interval;
    if (totalDuration <= 5 * 60 * 1000) {
        interval = 15 * 1000;
    } else if (totalDuration <= 30 * 60 * 1000) {
        interval = 60 * 1000;
    } else if (totalDuration <= 2 * 60 * 60 * 1000) {
        interval = 5 * 60 * 1000;
    } else {
        interval = 15 * 60 * 1000;
    }

    const uniquePostures = [...new Set(logs.map(log => log.posture))];

    const sortedLogs = [...logs].sort((a, b) => 
        new Date(a.timestamp) - new Date(b.timestamp)
    );

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

    const labels = Object.keys(timePoints).sort();
    return { labels, data: timePoints };
}

function formatTimeLabel(date, interval) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    if (interval < 60 * 1000) {
        return `${hours}:${minutes}:${seconds}`;
    } else if (interval < 60 * 60 * 1000) {
        return `${hours}:${minutes}:${seconds}`;
    } else {
        return `${hours}:${minutes}`;
    }
}

let confirmCallback = null;

function openConfirmModal(message, callback) {
    const modal = document.getElementById('confirm-modal');
    const messageElement = document.getElementById('confirm-message');
    if (modal && messageElement) {
        messageElement.textContent = message;
        confirmCallback = callback;
        modal.style.display = 'flex';
    }
}

window.closeConfirmModal = function() {
    const modal = document.getElementById('confirm-modal');
    if (modal) {
        modal.style.display = 'none';
        confirmCallback = null;
    }
}

window.confirmAction = function() {
    if (confirmCallback) {
        confirmCallback();
    }
    closeConfirmModal();
}

window.clearLogs = function() {
    openConfirmModal('Are you sure you want to clear logs? This action is irreversible.', async function() {
        try {
            await database.ref('posture-logs').set(null);
            
            postureLogs = [];
            sessionStartTime = null;
            localStorage.removeItem('sessionStartTime');
            
            if (labelContainer) {
                // labelContainer.innerHTML = '';
            }
            
            console.log('All logs cleared successfully! (Denied Write permissions for now)');
        } catch (error) {
            console.error('Error clearing logs:', error);
            console.log('Error clearing logs. Please try again.');
        }
    });
};

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
            - Logging to Database: ${isLoggingEnabled ? "On" : "Off"}
        `;
    } else {
        statusElement.innerHTML = `
            <span style="color: #666;">●</span> 
            Webcam inactive
        `;
    }
}

async function retryOperation(operation, maxAttempts = 3) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await operation();
        } catch (error) {
            if (attempt === maxAttempts) throw error;
            await new Promise(resolve => setTimeout(resolve, attempt * 1000));
        }
    }
}

function findSustainedPoorPostures(logs, minDurationMs = 5 * 60 * 1000) {
    const sustainedPeriods = [];
    let currentPosture = null;
    let startTime = null;

    for (let i = 0; i < logs.length; i++) {
        const log = logs[i];
        const posture = log.posture;
        const timestamp = new Date(log.timestamp).getTime();

        if (posture !== 'Neutral') {
            if (currentPosture === posture && i > 0) {
                const prevTime = new Date(logs[i - 1].timestamp).getTime();
                if (timestamp - prevTime < 2000) {
                    if (timestamp - startTime >= minDurationMs) {
                        sustainedPeriods.push(posture);
                    }
                } else {
                    currentPosture = posture;
                    startTime = timestamp;
                }
            } else {
                currentPosture = posture;
                startTime = timestamp;
            }
        } else {
            currentPosture = null;
            startTime = null;
        }
    }
    return [...new Set(sustainedPeriods)];
}

function generateRecommendations(analysis) {
    const { posturePercentages, sustainedPoorPostures } = analysis;
    const recommendations = [];

    if (posturePercentages['Neutral'] > 70) {
        recommendations.push("Great job maintaining a neutral posture most of the time!");
    } else {
        recommendations.push("Try to maintain a neutral posture more consistently.");
    }

    const dominantPoorPostures = Object.keys(posturePercentages)
        .filter(p => p !== 'Neutral' && posturePercentages[p] > 20);

    dominantPoorPostures.forEach(posture => {
        recommendations.push(getPostureAdvice(posture));
    });

    if (dominantPoorPostures.includes('Slouched Forward') && dominantPoorPostures.includes('Head Dropping')) {
        recommendations.push("You often slouch forward and let your head drop, which can significantly strain your neck and back. Sit up straight, align your head with your spine, and consider a chair with better support or frequent stretch breaks.");
    } else if (dominantPoorPostures.includes('Slouched Sidewards') && dominantPoorPostures.includes('Chair Lean')) {
        recommendations.push("You tend to lean sideways and rely heavily on your chair. This can cause muscle imbalance. Sit evenly with proper back support and try core-strengthening exercises.");
    } else if (dominantPoorPostures.includes('Cross Legged') && dominantPoorPostures.includes('Slouched Backwards')) {
        recommendations.push("Crossing your legs while leaning back may lead to discomfort and poor circulation. Keep both feet flat on the floor and sit upright with lumbar support.");
    }

    if (sustainedPoorPostures.length > 0) {
        recommendations.push("You maintained poor posture for extended periods. Set reminders every 20-30 minutes to check your posture or take short stretch breaks.");
    }

    recommendations.push("Take regular breaks to stretch and move around every hour.");
    recommendations.push("Ensure your chair and desk are ergonomically set up to support your back and neck.");

    return recommendations;
}

function getPostureAdvice(posture) {
    const advice = {
        'Cross Legged': "Try to avoid sitting with your legs crossed for long periods. It can restrict circulation and cause discomfort. Keep both feet flat on the floor instead.",
        'Slouched Forward': "You’re slouching forward often. Sit up straight with your back against the chair to reduce neck and back strain. Adjust your chair or screen height if needed.",
        'Slouched Sidewards': "Leaning to one side can imbalance your muscles. Sit evenly with both hips aligned and use a supportive chair.",
        'Slouched Backwards': "Leaning back too much may strain your back. Adjust your chair to support your lower back and sit upright.",
        'Head Dropping': "Your head drops forward frequently, which can strain your neck. Keep your head aligned with your spine and consider raising your screen.",
        'Chair Lean': "Improper chair leaning can misalign your posture. Ensure your chair supports your back fully and sit straight."
    };
    return advice[posture] || "";
}

window.toggleLogging = function() {
    isLoggingEnabled = !isLoggingEnabled;
    const button = document.getElementById('toggle-logging-btn');
    if (button) {
        button.textContent = isLoggingEnabled ? "Disable Logging" : "Enable Logging";
        button.classList.toggle('disabled', !isLoggingEnabled);
        console.log("Logging " + (isLoggingEnabled ? "enabled" : "disabled"));
    }
};