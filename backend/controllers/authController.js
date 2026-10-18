import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import './Register.css'; // Import the new CSS file

const API_URL = "https://pairhaven.onrender.com";

function Register() {
  const [formData, setFormData] = useState({
    name: '', email: '', phone: '', password: '', age: '', gender: '', bio: ''
  });
  const [photos, setPhotos] = useState([]);
  const [error, setError] = useState('');
  const [coords, setCoords] = useState({ lng: 0, lat: 0 });
  const navigate = useNavigate();

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setCoords({ lng: pos.coords.longitude, lat: pos.coords.latitude }),
        (err) => console.warn('Geolocation not available or denied', err),
        { enableHighAccuracy: false, timeout: 5000 }
      );
    }
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handlePhotoChange = (e) => {
    setPhotos(Array.from(e.target.files));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    try {
      const data = new FormData();
      Object.keys(formData).forEach(key => data.append(key, formData[key]));

      // append interests as JSON string (empty array for now)
      data.append('interests', JSON.stringify([]));

      // append location in the shape backend expects
      const locationObj = {
        coordinates: JSON.stringify([coords.lng, coords.lat]),
        address: ''
      };

      // Because FormData fields are strings, stringify the location object
      data.append('location', JSON.stringify(locationObj));

      photos.forEach(photo => data.append('photos', photo));

      await axios.post(`${API_URL}/api/auth/register`, data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      alert('Registration successful! Please log in.');
      navigate('/login');
    } catch (err) {
      console.error('Registration error', err.response || err);
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    }
  };

  return (
    <div className="register-container">
      <div className="register-card">
        <h2>Join PairHaven</h2>
        {error && <p style={{ color: 'red', textAlign: 'center', marginBottom: '1rem' }}>{error}</p>}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <input name="name" placeholder="Full Name" onChange={handleChange} required />
          </div>
          <div className="form-group">
            <input name="email" type="email" placeholder="Email Address" onChange={handleChange} required />
          </div>
          <div className="form-group">
            <input name="phone" placeholder="Phone Number" onChange={handleChange} required />
          </div>
          <div className="form-group">
            <input name="password" type="password" placeholder="Password" onChange={handleChange} required />
          </div>
          
          <div style={{ display: 'flex', gap: '10px' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <input name="age" type="number" placeholder="Age" onChange={handleChange} required />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <select name="gender" onChange={handleChange} required>
                <option value="">Gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <textarea name="bio" placeholder="Tell us about yourself..." rows="3" onChange={handleChange} required />
          </div>

          <div className="form-group">
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem', color: '#666' }}>
              Upload Photos (Min 2)
            </label>
            <input type="file" multiple accept="image/*" onChange={handlePhotoChange} required 
                   style={{ padding: '8px', background: '#f9f9f9' }} />
          </div>

          <button type="submit" className="submit-btn">Create Account</button>
        </form>

        <p className="login-link">
          Already have an account? <Link to="/login">Log In</Link>
        </p>
      </div>
    </div>
  );
}

export default Register;