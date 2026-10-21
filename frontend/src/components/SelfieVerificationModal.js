import React, { useRef, useState } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'https://pairhaven.onrender.com';

function SelfieVerificationModal({ onClose, onSuccess }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [streamStarted, setStreamStarted] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [loading, setLoading] = useState(false);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setStreamStarted(true);
      }
    } catch (err) {
      alert("Unable to access camera. Please allow camera permissions.");
    }
  };

  const captureSnap = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video && canvas) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg');
      setCapturedImage(dataUrl);

      // Stop camera stream
      const stream = video.srcObject;
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      setStreamStarted(false);
    }
  };

  const submitVerification = async () => {
    if (!capturedImage) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_URL}/api/users/verify-selfie`, { image: capturedImage }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert("Live selfie submitted! Admin will review and grant your Blue Badge.");
      onSuccess();
      onClose();
    } catch (err) {
      alert("Failed to submit selfie for verification.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '16px', maxWidth: '400px', width: '90%', textAlign: 'center' }}>
        <h3>📸 Live Camera Verification</h3>
        <p style={{ fontSize: '0.85rem', color: '#64748b' }}>Take a live selfie right now to prove you match your photos and get your 🟦 Blue Badge.</p>

        {!capturedImage && (
          <div style={{ position: 'relative', width: '100%', height: '260px', background: '#000', borderRadius: '12px', overflow: 'hidden', marginBottom: '1rem' }}>
            <video ref={videoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        )}

        {capturedImage && (
          <div style={{ width: '100%', height: '260px', borderRadius: '12px', overflow: 'hidden', marginBottom: '1rem' }}>
            <img src={capturedImage} alt="Live Snap" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        )}

        <canvas ref={canvasRef} style={{ display: 'none' }} />

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
          {!streamStarted && !capturedImage && (
            <button onClick={startCamera} style={{ background: '#5b72f2', color: '#fff', border: 'none', padding: '0.6rem 1.2rem', borderRadius: '8px', fontWeight: 700 }}>
              Open Camera
            </button>
          )}

          {streamStarted && (
            <button onClick={captureSnap} style={{ background: '#10b981', color: '#fff', border: 'none', padding: '0.6rem 1.2rem', borderRadius: '8px', fontWeight: 700 }}>
              📸 Take Snap
            </button>
          )}

          {capturedImage && (
            <>
              <button onClick={() => { setCapturedImage(null); startCamera(); }} style={{ background: '#e2e8f0', color: '#334155', border: 'none', padding: '0.6rem 1rem', borderRadius: '8px' }}>
                Retake
              </button>
              <button onClick={submitVerification} disabled={loading} style={{ background: '#5b72f2', color: '#fff', border: 'none', padding: '0.6rem 1.2rem', borderRadius: '8px', fontWeight: 700 }}>
                {loading ? 'Submitting...' : 'Submit Selfie'}
              </button>
            </>
          )}

          <button onClick={onClose} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', padding: '0.6rem 1rem', borderRadius: '8px' }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default SelfieVerificationModal;
