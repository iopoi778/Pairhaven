import React, { useState, useEffect } from 'react';
import AgoraRTC, {
  AgoraRTCProvider,
  useJoin,
  useLocalCameraTrack,
  useLocalMicrophoneTrack,
  usePublish,
  useRemoteUsers,
  RemoteUser,
  LocalVideoTrack
} from 'agora-rtc-react';

// Create Agora client instance
const agoraClient = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });

export default function CallModal({ appId, channelName, token, callType, onClose }) {
  return (
    <AgoraRTCProvider client={agoraClient}>
      <div style={modalOverlayStyle}>
        <div style={modalContentStyle}>
          <h3>{callType === 'video' ? '📹 Video Call' : '📞 Voice Call'}</h3>
          <CallRoom 
            appId={appId} 
            channelName={channelName} 
            token={token} 
            callType={callType} 
            onClose={onClose} 
          />
        </div>
      </div>
    </AgoraRTCProvider>
  );
}

function CallRoom({ appId, channelName, token, callType, onClose }) {
  const isVideo = callType === 'video';

  // Join Agora Channel
  useJoin({ appid: appId, channel: channelName, token: token || null });

  // Get local tracks
  const { localMicrophoneTrack } = useLocalMicrophoneTrack(true);
  const { localCameraTrack } = useLocalCameraTrack(isVideo);

  // Publish tracks
  usePublish([localMicrophoneTrack, localCameraTrack].filter(Boolean));

  // Get remote connected users
  const remoteUsers = useRemoteUsers();

  return (
    <div style={{ textAlign: 'center' }}>
      {/* Video Windows (If Video Call) */}
      {isVideo && (
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '1rem' }}>
          {/* My Video Stream */}
          <div style={videoBoxStyle}>
            <p style={labelStyle}>You</p>
            {localCameraTrack && <LocalVideoTrack track={localCameraTrack} play style={{ width: '100%', height: '100%', borderRadius: '10px' }} />}
          </div>

          {/* Remote User Stream */}
          {remoteUsers.map(user => (
            <div key={user.uid} style={videoBoxStyle}>
              <p style={labelStyle}>{user.uid}</p>
              <RemoteUser user={user} style={{ width: '100%', height: '100%', borderRadius: '10px' }} />
            </div>
          ))}
        </div>
      )}

      {/* Voice Call Active UI */}
      {!isVideo && (
        <div style={{ padding: '2rem 0', fontSize: '1.2rem', color: '#5b72f2' }}>
          🎙️ Audio Call Connected...
        </div>
      )}

      {/* End Call Button */}
      <button onClick={onClose} style={endCallButtonStyle}>
        🛑 End Call
      </button>
    </div>
  );
}

// Styling
const modalOverlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' };
const modalContentStyle = { background: '#fff', padding: '1.5rem', borderRadius: '16px', width: '90%', maxWidth: '500px', textAlign: 'center' };
const videoBoxStyle = { width: '180px', height: '240px', background: '#222', borderRadius: '10px', position: 'relative', overflow: 'hidden' };
const labelStyle = { position: 'absolute', bottom: '5px', left: '8px', color: '#fff', margin: 0, fontSize: '0.75rem', zIndex: 10, background: 'rgba(0,0,0,0.5)', padding: '2px 6px', borderRadius: '4px' };
const endCallButtonStyle = { background: '#e53e3e', color: '#fff', border: 'none', padding: '0.8rem 1.8rem', borderRadius: '30px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', marginTop: '1rem' };
