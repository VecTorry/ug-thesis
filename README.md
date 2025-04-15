"# ug-thesis"


Firebase link: https://console.firebase.google.com/project/ug-thesis-fb/overview


LATEST CHANGES:
- Updated node_modules folder library.
- Added dark mode option on UI.
- Added loading spinner UI on camera initialization.
- Added confidence level bar style.
- Fixed metadata classes.
- Added recommendations on report.
- Slightly fixed posture class colouring in generated report.
- Added option to either turn on or off database logging despite camera status.
- Added Firebase database logged postures count displaying in real time.


PREVIOUS CHANGES:
- Added Google's Firebase for data management. May have much more potentials for the future.
- Detached JavaScript and CSS on different files: scripts.js and styles.css.
- Initialized "npm init -y" on bash for local host then "npm install firebase"
- Several thousand changes in node_modules folder due to the previous action listed.
- Fixed "Close Camera" button and function to properly stop camera feedback and logging in Firebase.
- Added "Generate Report" button and function to print out logged poses in PDF form from Firebase database.
- Added "Clear Logs" button and function to clear logged postures on Firebase database.
- NEW pose labels: Neutral, Cross Legged, Slouched Forward, Side Slouch, Slouched Backward, Head Dropping (changed files:metadata.json, model.json, & weights.bin)
- Flexible software: Able to feed on imported TensorFlow.js without software changes (Potential feature where user can import their own models).
- Removed requirements.txt file.
- Added preview of generated report before downloading as pdf file.
- Added error handling and web browser logging for easier debugging.
- Slightly improved report UI for readability


KNOWN ISSUES:
1) N/A


NOTES:
- This branch is the backup for default branch: master.


NEXT TASK(S):
- Continue further development and deployment to default branch—master. Attempt to deploy to Firebase using master branch.


ROAD MAP:
1) [DONE] Verify use of Google's Teachable Machine model for use into web based system if feasible.

2) [DONE] System will be able to read captured test poses trained on TM (Teachable Machine) and display the detected pose live with confidence score for the user to see.

3) [DONE] System will log individual detected poses for 1 frame every second, then output the full list of all the poses into what ever is compatible for analyzation.

4) [Done] The log & records will be summarized into a pop-up tab which could also be automatically or manually downloaded after user prompt.

5) [DONE] Deploy the system to be accessible through the use of internet instead of a local host with a local port.

6) [Done] Add in extra CSS designs to make the system more visually appealing and user-friendly.

7) [IN PROGRESS INDEFINITELY] Maintain the deployed software and fix post-deployment bugs.