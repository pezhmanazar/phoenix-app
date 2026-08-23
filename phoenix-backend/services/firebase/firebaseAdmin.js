//phoenix-backend/services/firebase/firebaseAdmin.js
import admin from "firebase-admin";

let firebaseAdmin = null;

export function getFirebaseAdmin() {
  if (firebaseAdmin) {
    return firebaseAdmin;
  }

  const serviceAccount = {
    type: "service_account",
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
  };

  if (!serviceAccount.project_id || !serviceAccount.private_key || !serviceAccount.client_email) {
    throw new Error("Firebase credentials are missing");
  }

  firebaseAdmin = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  return firebaseAdmin;
}