import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js';
import { getDatabase, ref, push, set } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-database.js';

const firebaseConfig = {
    apiKey: "AIzaSyBJ2JvbGg2m2E4Lqn3Ndu9lxZSoXfRvT3E",
    authDomain: "ug-thesis-fb.firebaseapp.com",
    projectId: "ug-thesis-fb",
    databaseURL: "https://ug-thesis-fb-default-rtdb.asia-southeast1.firebasedatabase.app",
    storageBucket: "ug-thesis-fb.firebasestorage.app",
    messagingSenderId: "540958723213",
    appId: "1:540958723213:web:4176826738ef9aa59da6c4",
    measurementId: "G-E9T15CH7FT"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

let model, webcam, ctx, labelContainer, maxPredictions, loggingInterval;
let postureLogs = [];
const URL = window.location.origin + "/";

// Make functions global
window.init = async function() {
    const modelURL = URL + "model.json";
    const metadataURL = URL + "metadata.json";
    model = await tmPose.load(modelURL, metadataURL);
    maxPredictions = model.getTotalClasses();

    const size = 400;
    const flip = true;
    webcam = new tmPose.Webcam(size, size, flip);
    await webcam.setup();
    await webcam.play();
    window.requestAnimationFrame(loop);

    const canvas = document.getElementById("canvas");
    canvas.width = size;
    canvas.height = size;
    ctx = canvas.getContext("2d");
    
    labelContainer = document.getElementById("label-container");
    for (let i = 0; i < maxPredictions; i++) {
        labelContainer.appendChild(document.createElement("div"));
    }
    
    document.getElementById("report-btn").style.display = "block";
    // Store the interval reference
    loggingInterval = setInterval(logPosture, 1000);
};

async function loop(timestamp) {
    webcam.update();
    await predict();
    window.requestAnimationFrame(loop);
}

async function predict() {
    const { pose, posenetOutput } = await model.estimatePose(webcam.canvas);
    const prediction = await model.predict(posenetOutput);

    for (let i = 0; i < maxPredictions; i++) {
        const classPrediction =
            prediction[i].className + ": " + prediction[i].probability.toFixed(2);
        labelContainer.childNodes[i].innerHTML = classPrediction;
    }

    drawPose(pose);
}

function drawPose(pose) {
    if (webcam.canvas) {
        ctx.drawImage(webcam.canvas, 0, 0);
        if (pose) {
            const minPartConfidence = 0.5;
            tmPose.drawKeypoints(pose.keypoints, minPartConfidence, ctx);
            tmPose.drawSkeleton(pose.keypoints, minPartConfidence, ctx);
        }
    }
}

async function logPosture() {
    if (!model || !webcam.canvas) return;

    const { pose, posenetOutput } = await model.estimatePose(webcam.canvas);
    const prediction = await model.predict(posenetOutput);
    const timestamp = new Date().toISOString();
    const highestPrediction = prediction.reduce((prev, current) => 
        (prev.probability > current.probability) ? prev : current
    );

    const logEntry = {
        timestamp: timestamp,
        posture: highestPrediction.className,
        confidence: highestPrediction.probability
    };

    postureLogs.push(logEntry);
    await push(ref(database, 'posture-logs'), logEntry);
}

window.stopWebcam = function() {
    if (webcam) {
        webcam.stop();
        // Clear the logging interval
        if (loggingInterval) {
            clearInterval(loggingInterval);
            loggingInterval = null;
        }
    }
};

window.generateReport = async function() {
    const analysis = analyzePostureLogs(postureLogs);
    const doc = new window.jsPDF();
    
    // Title
    doc.setFontSize(20);
    doc.text("Posture Analysis Report", 20, 20);
    
    // Session Info
    doc.setFontSize(12);
    doc.text(`Total Session Time: ${analysis.totalTime} minutes`, 20, 40);
    
    // Posture Distribution
    doc.text("Posture Distribution:", 20, 60);
    let yOffset = 70;
    Object.entries(analysis.posturePercentages).forEach(([posture, percentage]) => {
        doc.text(`${posture}: ${percentage}% (${analysis.postureCounts[posture]} times)`, 30, yOffset);
        yOffset += 10;
    });

    // Create chart canvas
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 200;
    document.body.appendChild(canvas);

    // Create pie chart
    new Chart(canvas.getContext('2d'), {
        type: 'pie',
        data: {
            labels: Object.keys(analysis.posturePercentages),
            datasets: [{
                data: Object.values(analysis.posturePercentages),
                backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56']
            }]
        }
    });

    // Add chart to PDF
    doc.addImage(canvas.toDataURL(), 'PNG', 20, yOffset, 160, 80);
    document.body.removeChild(canvas);

    // Time Series Analysis
    yOffset += 100;
    doc.text("Hourly Distribution:", 20, yOffset);
    
    // Create line chart canvas
    const timeCanvas = document.createElement('canvas');
    timeCanvas.width = 400;
    timeCanvas.height = 200;
    document.body.appendChild(timeCanvas);

    // Prepare time series data
    const hours = Object.keys(analysis.timeSeriesData).sort();
    const datasets = Object.keys(analysis.postureCounts).map(posture => ({
        label: posture,
        data: hours.map(hour => analysis.timeSeriesData[hour][posture] || 0),
        borderColor: posture === 'good' ? '#36A2EB' : '#FF6384',
        fill: false
    }));

    // Create line chart
    new Chart(timeCanvas.getContext('2d'), {
        type: 'line',
        data: {
            labels: hours.map(h => `${h}:00`),
            datasets
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });

    // Add time series chart to PDF
    doc.addImage(timeCanvas.toDataURL(), 'PNG', 20, yOffset + 10, 160, 80);
    document.body.removeChild(timeCanvas);

    doc.save("posture-analysis-report.pdf");
};

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

window.clearLogs = async function() {
    try {
        // Clear Firebase database
        await set(ref(database, 'posture-logs'), null);
        
        // Clear local logs array
        postureLogs = [];
        
        alert('All logs cleared successfully!');
    } catch (error) {
        console.error('Error clearing logs:', error);
        alert('Error clearing logs. Please try again.');
    }
};