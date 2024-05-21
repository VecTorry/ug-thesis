import cv2
import mediapipe as mp
import numpy as np

# Create Holistic object inside a 'with' statement
with mp.solutions.holistic.Holistic(min_detection_confidence=0.5, min_tracking_confidence=0.5) as holistic:
    mp_draw = mp.solutions.drawing_utils
    connection_pairs = mp.solutions.holistic.POSE_CONNECTIONS

    cap = cv2.VideoCapture("C:\\Users\\Barrongo\\Pictures\\THESIS\\Videos\\video0.mp4")
    # cap = cv2.VideoCapture(0)

    while True:
        ret, img = cap.read()
        if not ret:
            print("Ignoring empty camera frame.")
            break

        # Resize the image for processing
        img_resized = cv2.resize(img, (850, 625))
        
        # Convert the image to RGB as MediaPipe requires images in RGB format
        img_rgb = cv2.cvtColor(img_resized, cv2.COLOR_BGR2RGB)

        # Process the image and detect the holistic landmarks
        results = holistic.process(img_rgb)

        # Draw pose landmarks
        if results.pose_landmarks:
            mp_draw.draw_landmarks(img, results.pose_landmarks, connection_pairs,
                                   mp_draw.DrawingSpec(color=(255, 0, 255), thickness=2, circle_radius=2),
                                   mp_draw.DrawingSpec(color=(0, 0, 255), thickness=1, circle_radius=1))

        # Draw face landmarks
        if results.face_landmarks:
            mp_draw.draw_landmarks(img, results.face_landmarks, mp.solutions.holistic.FACEMESH_TESSELATION,
                                   mp_draw.DrawingSpec(color=(80,110,10), thickness=1, circle_radius=1),
                                   mp_draw.DrawingSpec(color=(80,256,121), thickness=1, circle_radius=1))

        # Draw left and right hand landmarks
        if results.left_hand_landmarks:
            mp_draw.draw_landmarks(img, results.left_hand_landmarks, mp.solutions.holistic.HAND_CONNECTIONS,
                                   mp_draw.DrawingSpec(color=(121,22,76), thickness=2, circle_radius=2),
                                   mp_draw.DrawingSpec(color=(121,44,250), thickness=2, circle_radius=2))
        if results.right_hand_landmarks:
            mp_draw.draw_landmarks(img, results.right_hand_landmarks, mp.solutions.holistic.HAND_CONNECTIONS,
                                   mp_draw.DrawingSpec(color=(245,117,66), thickness=2, circle_radius=2),
                                   mp_draw.DrawingSpec(color=(245,66,230), thickness=2, circle_radius=2))

        cv2.imshow("Pose Estimation", img)
        if cv2.waitKey(1) & 0xFF == ord(' '):
            break
        '''
        print(results.pose_landmarks)
        print(results.face_landmarks)
        print(results.left_hand_landmarks)
        print(results.right_hand_landmarks)
        '''

    cap.release()
    cv2.destroyAllWindows()
