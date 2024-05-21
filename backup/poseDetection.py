import cv2
import mediapipe as mp
import numpy as np

mp_pose = mp.solutions.pose
mp_draw = mp.solutions.drawing_utils
pose = mp_pose.Pose()
# cap = cv2.VideoCapture("C:\\Users\\Barrongo\\Pictures\\THESIS\\Videos\\video0.mp4")
cap = cv2.VideoCapture(0)

while True:
    ret, img = cap.read()
    img = cv2.resize(img, (850, 625))

    results = pose.process(img)
    mp_draw.draw_landmarks(img, results.pose_landmarks, mp_pose.POSE_CONNECTIONS,
                           mp_draw.DrawingSpec((0, 0, 255), 2, 2),
                           mp_draw.DrawingSpec((0, 255, 0), 1, 1))

    h, w, c = img.shape
    opImg = np.zeros([h, w, c])
    opImg.fill(255)
    mp_draw.draw_landmarks(opImg, results.pose_landmarks, mp_pose.POSE_CONNECTIONS,
                           mp_draw.DrawingSpec((255, 0, 255), 2, 2),
                           mp_draw.DrawingSpec((0, 0, 0), 1, 1))
    cv2.imshow("Extracted Pose", opImg)

    print(results.pose_landmarks)
    cv2.imshow("Pose Estimation", img)

    if cv2.waitKey(1) & 0xFF == ord(' '):
            break

cap.release()
cv2.destroyAllWindows()