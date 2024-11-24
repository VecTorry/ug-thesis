"# ug-thesis"

Commit: "Original Teachable Machine code snippet integrated"

CHANGELOG:

Bugfix:
- Fixed _Media typo
- "URL" on *URL + "model.json"* removed
- webcam "getVideo" line corrected

Stability:
- Presumably fixed element memory leak related to camera.

UI:
- Smaller webcam display (will soon be changed to a more suitable size).
- Offset webcam display (will soon be change to a more suitable position).
- Removed "Predicted pose" UI below the webcam feed.
- Confidence scores now shows correctly.
- Pose landmarks and joints are now showing.

Model:
- Model changed from "Standing" and "T-Pose" to: "Standing" and "Running" (Model confidently reads the "Running" pose when user is "running" on their left side, but struggles when "running" facing the right).
- Model is now being read properly.
- Model now works together with the confidence scores, pose landmarks, and joints display on the webcam feed.


NEXT TASK:
- Log predicted poses: capture 1 frame every secondm, then log the different postures that were recognized.


Road Map:
1) [DONE] Veriy use of Google's Teachable Machine model for use into web based system if feasible.

2) [DONE] System will be able to read/predict captured test poses trained on TM (Teachable Machine) and display the detected pose live with confidence score for the user to see.

3) [IN PROGRESS] System will log individual detected poses for 1 fram every second, then output the full list of all the poses into what ever is compatible for analyzation.

4) The log will be analyzed by another AI which would summarize into a detailed reported if a user has had a bad or good posture, and will provide recommendations for improvement.

5) Deploy the system to be accessible throgh the use of internet instead of a local host with a loca port.

6) Add in extra CSS designs to make the system more visually appealing and user-friendly.

7) Maintain the deployed software and fix post-deployment bugs.