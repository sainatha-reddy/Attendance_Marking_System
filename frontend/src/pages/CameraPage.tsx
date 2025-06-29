import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, ArrowLeft, RotateCcw, X, Loader2, AlertTriangle, CheckCircle } from 'lucide-react';

// Utility: Convert base64 Data URL to File object with correct MIME
function dataURLtoFile(dataUrl: string, filename: string): File {
  const arr = dataUrl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  
  return new File([u8arr], filename, { type: mime });
}

const CameraPage: React.FC = () => {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  // Check if we're on HTTPS (required for camera access in production)
  const isSecure = window.location.protocol === 'https:' || window.location.hostname === 'localhost';

  // Test camera availability
  const testCameraAvailability = async () => {
    try {
      console.log('🔍 Testing camera availability...');
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      console.log('📹 Available video devices:', videoDevices);
      return videoDevices.length > 0;
    } catch (error) {
      console.error('❌ Error enumerating devices:', error);
      return false;
    }
  };

  const startCamera = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Check if we're on HTTPS
      if (!isSecure) {
        setError('Camera access requires HTTPS. Please use a secure connection.');
        setIsLoading(false);
        return;
      }

      // Test camera availability first
      const hasCamera = await testCameraAvailability();
      if (!hasCamera) {
        setError('No camera devices found on your system.');
        setIsLoading(false);
        return;
      }

      // Stop existing stream if any
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }

      const constraints = {
        video: {
          facingMode: facingMode,
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 }
        },
        audio: false
      };

      console.log('🎥 Requesting camera access with constraints:', constraints);
      console.log('🔒 Secure context:', isSecure);
      console.log('📱 User agent:', navigator.userAgent);

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('✅ Camera stream obtained:', newStream);
      console.log('📹 Video tracks:', newStream.getVideoTracks());
      console.log('🎤 Audio tracks:', newStream.getAudioTracks());
      
      setStream(newStream);
      
      // Simple approach: wait and then try to set the video source
      setTimeout(() => {
        console.log('🎬 Attempting to set video source...');
        
        // Try to find video element
        const videoEl = document.querySelector('video');
        console.log('🎬 Video element found:', !!videoEl);
        
        if (videoEl) {
          console.log('🎬 Setting video source...');
          videoEl.srcObject = newStream;
          
          videoEl.onloadedmetadata = () => {
            console.log('✅ Video metadata loaded');
            console.log('📐 Video dimensions:', videoEl.videoWidth, 'x', videoEl.videoHeight);
          };
          
          videoEl.oncanplay = () => {
            console.log('✅ Video can play');
          };
          
          videoEl.onerror = (e) => {
            console.error('❌ Video error:', e);
          };
        } else {
          console.error('❌ No video element found');
        }
      }, 1000); // Wait 1 second
      
    } catch (err: unknown) {
      console.error('❌ Error accessing camera:', err);
      
      let errorMessage = 'Unable to access camera. Please check your permissions and try again.';
      
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          errorMessage = 'Camera permission denied. Please allow camera access in your browser settings and try again.';
        } else if (err.name === 'NotFoundError') {
          errorMessage = 'No camera found on your device. Please connect a camera and try again.';
        } else if (err.name === 'NotSupportedError') {
          errorMessage = 'Camera not supported on this device or browser.';
        } else if (err.name === 'NotReadableError') {
          errorMessage = 'Camera is already in use by another application. Please close other camera apps and try again.';
        } else if (err.name === 'OverconstrainedError') {
          errorMessage = 'Camera constraints not met. Please try switching cameras.';
        } else if (err.name === 'TypeError') {
          errorMessage = 'Camera access not supported in this browser. Please use a modern browser with camera support.';
        }
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [facingMode, stream, isSecure]);

  useEffect(() => {
    startCamera();

    // Add a timeout to detect if camera is not working
    const cameraTimeout = setTimeout(() => {
      if (isLoading && !stream) {
        console.log('⏰ Camera timeout - video feed may be black');
        setError('Camera feed appears to be black. You can still try to capture an image or proceed without camera.');
      }
    }, 5000); // 5 second timeout

    // Monitor video element rendering
    const checkVideoElement = () => {
      const videoEl = document.querySelector('video');
      console.log('🔍 Checking video element in DOM:', !!videoEl);
      if (videoEl) {
        console.log('✅ Video element found in DOM');
        console.log('🎬 Video element properties:', {
          srcObject: !!videoEl.srcObject,
          readyState: videoEl.readyState,
          videoWidth: videoEl.videoWidth,
          videoHeight: videoEl.videoHeight
        });
      }
    };

    // Check immediately and after a delay
    checkVideoElement();
    setTimeout(checkVideoElement, 2000);

    return () => {
      clearTimeout(cameraTimeout);
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [facingMode]);

  const captureImage = () => {
    console.log('📸 Attempting to capture image...');
    
    // Try to get video element from ref first
    let video = videoRef.current;
    
    // Fallback: if ref is null, try to find video element by selector
    if (!video) {
      console.log('🔄 Video ref is null, trying to find video element by selector...');
      video = document.querySelector('video');
    }
    
    if (!video) {
      console.error('❌ No video element found for capture');
      setError('Video element not found. Please refresh the page and try again.');
      return;
    }
    
    if (!canvasRef.current) {
      console.error('❌ Canvas ref is null');
      setError('Canvas element not found. Please refresh the page and try again.');
      return;
    }

    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) {
      console.error('❌ Could not get canvas context');
      setError('Canvas context not available. Please refresh the page and try again.');
      return;
    }

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    console.log('📸 Capturing image...');
    console.log('📐 Canvas dimensions:', canvas.width, 'x', canvas.height);
    console.log('🎬 Video ready state:', video.readyState);
    console.log('🎬 Video current time:', video.currentTime);

    // Draw the video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert to data URL
    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.9);
    console.log('✅ Image captured, data URL length:', imageDataUrl.length);
    setCapturedImage(imageDataUrl);

    // Stop the camera stream after capturing
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  // Fallback function to proceed without camera
  const proceedWithoutCamera = () => {
    console.log('🔄 Proceeding without camera...');
    // Create a dummy image or proceed directly to backend
    const dummyImage = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=';
    setCapturedImage(dummyImage);
  };

  const sendImageToBackend = async (imageData: string) => {
    setIsProcessing(true);
    setError(null);
    setSuccess(false);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      
      // Debug logging
      console.log('API URL:', apiUrl);
      console.log('Environment:', import.meta.env.MODE);
      console.log('VITE_API_URL set:', !!import.meta.env.VITE_API_URL);

      // Convert data URL to File object using utility
      const file = dataURLtoFile(imageData, 'photo.jpg');

      // Create FormData and append the file
      const formData = new FormData();
      formData.append('image', file); // 'image' must match backend

      console.log('Sending request to:', `${apiUrl}/api/mark-attendance`);
      
      const backendResponse = await fetch(`${apiUrl}/api/mark-attendance`, {
        method: 'POST',
        body: formData,
        // DO NOT set Content-Type header manually!
      });

      console.log('Response status:', backendResponse.status);
      console.log('Response headers:', Object.fromEntries(backendResponse.headers.entries()));

      if (!backendResponse.ok) {
        const errorText = await backendResponse.text();
        console.error('Backend error response:', errorText);
        
        if (backendResponse.status === 500) {
          throw new Error(`Server error (500): ${errorText}`);
        } else if (backendResponse.status === 404) {
          throw new Error(`API endpoint not found (404). Please check if the backend is deployed correctly.`);
        } else if (backendResponse.status === 0) {
          throw new Error(`Network error: Unable to connect to backend server. Please check if the backend is running and the API URL is correct.`);
        } else {
          throw new Error(`HTTP ${backendResponse.status}: ${errorText}`);
        }
      }

      const data = await backendResponse.json();
      console.log('Backend response data:', data);

      if (data.success) {
        setSuccess(true);
        setTimeout(() => {
          navigate('/home');
        }, 2000);
      } else {
        setError(data.message || 'Failed to mark attendance');
      }
    } catch (error) {
      console.error('Error sending image to backend:', error);
      
      let errorMessage = 'Failed to send image to server. Please try again.';
      
      if (error instanceof Error) {
        if (error.message.includes('fetch')) {
          errorMessage = 'Unable to connect to the server. Please check your internet connection and try again.';
        } else if (error.message.includes('API endpoint not found')) {
          errorMessage = 'Backend server is not available. Please contact support.';
        } else if (error.message.includes('Network error')) {
          errorMessage = 'Cannot connect to the attendance server. Please try again later.';
        } else {
          errorMessage = error.message;
        }
      }
      
      setError(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const clearCapture = () => {
    setCapturedImage(null);
    // Restart the camera for a retake
    startCamera();
  };

  const switchCamera = () => {
    setFacingMode(current => current === 'user' ? 'environment' : 'user');
  };

  const goBack = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    navigate('/home');
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Attendance Marked!</h2>
          <p className="text-gray-600 mb-6">Your attendance has been successfully recorded.</p>
          <div className="animate-pulse">
            <p className="text-sm text-gray-500">Redirecting to home page...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Camera Access Required</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          
          {!isSecure && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-yellow-800">
                <strong>Note:</strong> Camera access requires HTTPS. Your current connection is not secure.
              </p>
            </div>
          )}
          
          <div className="space-y-3">
            <button
              onClick={startCamera}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={goBack}
              className="w-full bg-gray-100 text-gray-700 py-3 px-4 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/50 to-transparent">
        <div className="flex justify-between items-center p-4">
          <button
            onClick={goBack}
            className="flex items-center justify-center w-10 h-10 bg-black/20 backdrop-blur-sm rounded-full text-white hover:bg-black/40 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          <h1 className="text-white font-semibold">Camera</h1>
          
          <button
            onClick={switchCamera}
            className="flex items-center justify-center w-10 h-10 bg-black/20 backdrop-blur-sm rounded-full text-white hover:bg-black/40 transition-colors"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Camera View */}
      <div className="relative h-screen flex flex-col">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Loader2 className="w-8 h-8 text-white animate-spin mx-auto mb-4" />
              <p className="text-white">Loading camera...</p>
            </div>
          </div>
        ) : isProcessing ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-4">Processing Attendance</h2>
              <p className="text-gray-300 max-w-md">
                Processing your image and marking attendance. Please wait...
              </p>
              <div className="mt-6 space-y-2">
                <div className="flex items-center justify-center space-x-2 text-sm text-gray-400">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                  <span>Processing face recognition...</span>
                </div>
                <div className="flex items-center justify-center space-x-2 text-sm text-gray-400">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span>Sending to server...</span>
                </div>
                <div className="flex items-center justify-center space-x-2 text-sm text-gray-400">
                  <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
                  <span>Marking attendance...</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 relative overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              
              {/* Fallback Button for Camera Issues */}
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10">
                <button
                  onClick={proceedWithoutCamera}
                  className="bg-yellow-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-yellow-700 transition-colors shadow-lg"
                >
                  Camera Not Working? Click Here
                </button>
              </div>
              
              {/* Capture Button */}
              <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
                <button
                  onClick={captureImage}
                  className="w-16 h-16 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-100 transition-colors relative"
                >
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center">
                    <Camera className="w-6 h-6 text-white" />
                  </div>
                </button>
              </div>
            </div>

            {/* Captured Image Display */}
            {capturedImage && (
              <div className="absolute inset-0 bg-black z-10 flex flex-col">
                <div className="flex-1 flex items-center justify-center p-4">
                  <img
                    src={capturedImage}
                    alt="Captured"
                    className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                  />
                </div>
                
                {/* Action Buttons */}
                <div className="flex justify-center space-x-4 p-6 bg-gradient-to-t from-black/80 to-transparent">
                  <button
                    onClick={clearCapture}
                    className="flex items-center justify-center w-12 h-12 bg-red-600 rounded-full text-white hover:bg-red-700 transition-colors"
                    aria-label="Retake Photo"
                  >
                    <X className="w-6 h-6" />
                  </button>
                  
                  <button
                    onClick={() => sendImageToBackend(capturedImage)}
                    className="flex items-center justify-center w-12 h-12 bg-green-600 rounded-full text-white hover:bg-green-700 transition-colors"
                    aria-label="Confirm Photo"
                  >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Hidden canvas for image capture */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default CameraPage;