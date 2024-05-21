import cv2
import mediapipe as mp
import os
import numpy as np

# Initialize the MediaPipe pose model and drawing utility
mp_pose = mp.solutions.pose
mp_drawing = mp.solutions.drawing_utils
pose = mp_pose.Pose(min_detection_confidence=0.5, min_tracking_confidence=0.5)

# Define the directory where the dataset is stored
data_dir = "path/to/dataset"

# Define the list of pose labels
pose_labels = ["Standing", "Sitting"]

# Define the function to classify the pose
def classify_pose(results):
    # Extract the keypoints of the pose
    left_hip = results.pose_landmarks.landmark[mp_pose.PoseLandmark.LEFT_HIP]
    right_hip = results.pose_landmarks.landmark[mp_pose.PoseLandmark.RIGHT_HIP]
    left_knee = results.pose_landmarks.landmark[mp_pose.PoseLandmark.LEFT_KNEE]
    right_knee = results.pose_landmarks.landmark[mp_pose.PoseLandmark.RIGHT_KNEE]
    left_ankle = results.pose_landmarks.landmark[mp_pose.PoseLandmark.LEFT_ANKLE]
    right_ankle = results.pose_landmarks.landmark[mp_pose.PoseLandmark.RIGHT_ANKLE]

    # Calculate the angles of the pose
    hip_angle = calculate_angle(left_hip, right_hip, left_knee)
    knee_angle = calculate_angle(left_knee, right_knee, left_ankle)

    # Classify the pose based on the angles
    if hip_angle > 150 and knee_angle > 150:
        return pose_labels[0]
    else:
        return pose_labels[1]

def calculate_angle(a, b, c):
    ab = np.array([a.x, a.y]) - np.array([b.x, b.y])
    bc = np.array([c.x, c.y]) - np.array([b.x, b.y])

    cos_angle = np.dot(ab, bc) / (np.linalg.norm(ab) * np.linalg.norm(bc))
    angle = np.arccos(cos_angle) * 180 / np.pi

    return angle

# Define the function to load the dataset
def load_dataset():
    images = []
    labels = []

    # Loop through all the subdirectories in the dataset directory
    for subdir in os.listdir(data_dir):
        subdir_path = os.path.join(data_dir, subdir)

        # Check if the subdirectory is a directory
        if os.path.isdir(subdir_path):
            # Loop through all the images in the subdirectory
            for img_path in os.listdir(subdir_path):
                img_path = os.path.join(subdir_path, img_path)

                # Load the image and append it to the images list
                img = cv2.imread(img_path)
                images.append(img)

                #Append the label to the labels list
                labels.append(subdir)

    return images, labels

# Load the dataset
images, labels = load_dataset()

# Create a dictionary to map labels to integers
label_dict = {label: i for i, label in enumerate(set(labels))}

# Convert the labels to integers
label_ints = [label_dict[label] for label in labels]

# Create a KNearestClassifier with 3 neighbors
from sklearn.neighbors import KNeighborsClassifier
knn = KNeighborsClassifier(n_neighbors=3)

# Train the classifier on the dataset
knn.fit(images, label_ints)

# Define the function to classify the pose in real-time
def classify_pose_in_real_time(image):
    # Process the image with MediaPipe
    results = pose.process(cv2.cvtColor(image, cv2.COLOR_BGR2RGB))

    # Classify the pose
    pose_label = classify_pose(results)

    # Display the pose label on the image
    cv2.putText(image, f"Pose: {pose_label}", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)

    # Display the image with the pose label
    cv2.imshow('Pose Detection', image)

# Capture video from the camera
cap = cv2.VideoCapture(0)

while True:
    # Read a frame from the camera
    ret, frame = cap.read()

    # Classify the pose in real-time
    classify_pose_in_real_time(frame)

    # Wait for a key press and exit if 'q' is pressed
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

# Release the camera and close the window
cap.release()
cv2.destroyAllWindows()