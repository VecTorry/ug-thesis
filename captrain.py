import cv2
import tkinter as tk
from tkinter import filedialog
from PIL import Image, ImageTk
import mediapipe as mp
import numpy as np
import os

# Initialize the pose tracker
mp_pose = mp.solutions.pose
mp_drawing = mp.solutions.drawing_utils
pose_tracker = mp_pose.Pose(min_detection_confidence=0.5, min_tracking_confidence=0.5)

# Initialize the camera
# cap = cv2.VideoCapture("C:\\Users\\Barrongo\\Pictures\\THESIS\\Videos\\video0.mp4")
cap = cv2.VideoCapture(0)

# Create the tkinter window
window = tk.Tk()
window.title("Image Capture")

# Create the tkinter label
label = tk.Label(window)
label.pack()

global image_count
# put documentation here
image_count = 0

# Function to capture an image and save it
def capture_image():
    """
    Captures an image from the camera feed and saves it.
    """

    # Capture a frame from the camera
    ret, frame = cap.read()

    # Get the width and height of the frame
    frame_width, frame_height, _ = frame.shape

    # Process the frame with MediaPipe pose tracker
    results = pose_tracker.process(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))

    # Draw the pose landmarks on the frame
    if results.pose_landmarks:
        mp_drawing.draw_landmarks(frame, results.pose_landmarks, mp_pose.POSE_CONNECTIONS)

    global image_count
    # Save the image with the current counter value
    cv2.imwrite(f"C:\\Users\\Barrongo\\Pictures\\THESIS\\dataset\\train\\image{image_count}.png", frame)

    # Increment the counter
    image_count += 1

# Create the "Capture Image" button
capture_button = tk.Button(window, text="Capture Image", command=capture_image)
capture_button.pack()

# Function to browse a directory and store it in the image_dir variable
def browse_directory():
    """
    Opens a file dialog to select a directory to save the images.
    """

    # Open a file dialog to select a directory
    directory = filedialog.askdirectory()

    # If a directory was selected, store it in the image_dir variable
    if directory:
        global image_dir
        image_dir = directory

# Create the "Browse Directory" button
browse_button = tk.Button(window, text="Browse Directory", command=browse_directory)
browse_button.pack()

# Function to update the feed in the tkinter label
def update_feed():
    """
    Updates the label with the camera feed.
    """

    # Capture a frame from the camera
    ret, frame = cap.read()

    # Get the width and height of the frame
    frame_width, frame_height, _ = frame.shape

    # Process the frame with MediaPipe pose tracker
    results = pose_tracker.process(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))

    # Draw the pose landmarks on the frame
    if results.pose_landmarks:
        mp_drawing.draw_landmarks(frame, results.pose_landmarks, mp_pose.POSE_CONNECTIONS)

    # Convert the frame to a format that can be displayed in the label
    img = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

    # Convert the img variable to a PIL image
    img = Image.fromarray(img)

    # Convert the PIL image to a Tkinter image
    img = ImageTk.PhotoImage(img)

    # Update the label with the camera feed
    label.config(image=img)
    label.image = img

    # Call the update_feed function again after a delay
    window.after(30, update_feed)

# Start updating thefeed in the tkinter label
update_feed()

# Run the tkinter event loop
window.mainloop()