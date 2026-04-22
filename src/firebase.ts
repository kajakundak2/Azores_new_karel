import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCNKO4STrlMtBpeUiROnRb_b0qvC6TY3xw",
  authDomain: "sara-itinerary.firebaseapp.com",
  projectId: "sara-itinerary",
  storageBucket: "sara-itinerary.firebasestorage.app",
  messagingSenderId: "180745465397",
  appId: "1:180745465397:web:b47fe1512a0ea899590b7c",
  measurementId: "G-0G96SBBY1H"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export const db = getFirestore(app);
