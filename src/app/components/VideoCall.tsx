"use client";

import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";

const VideoCall = () => {
  const [isCallStarted, setIsCallStarted] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const socket = useRef(io("http://192.168.96.124:3002")).current; // Socket connection

  useEffect(() => {
    // Get local video stream
    const getLocalStream = async () => {
      navigator.mediaDevices
        .getUserMedia({
          video: true,
          audio: true,
        })
        .then((stream) => {
          setLocalStream(stream);
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
          }
        })
        .catch((error) => {
          alert("Error accessing media devices:");
        });
    };

    getLocalStream();

    // Socket.io events
    socket.on("offer", handleOffer);
    socket.on("answer", handleAnswer);
    socket.on("ice-candidate", handleNewICECandidate);

    return () => {
      socket.off("offer");
      socket.off("answer");
      socket.off("ice-candidate");
    };
  }, []);

  const startCall = () => {
    setIsCallStarted(true);
    if (localStream) {
      createPeerConnection(localStream);
    }
  };

  const createPeerConnection = (stream: MediaStream) => {
    peerConnectionRef.current = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    // Add local stream to peer connection
    stream.getTracks().forEach((track) => {
      peerConnectionRef.current?.addTrack(track, stream);
    });

    // On remote stream added
    peerConnectionRef.current.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    // Create offer
    peerConnectionRef.current
      .createOffer()
      .then((offer) => {
        return peerConnectionRef.current?.setLocalDescription(offer);
      })
      .then(() => {
        alert(JSON.stringify(peerConnectionRef.current?.localDescription));
        socket.emit("offer", {
          offer: peerConnectionRef.current?.localDescription,
        });
      })
      .catch((error) => {
        alert(error);
      });

    // Handle ICE candidates
    peerConnectionRef.current.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice-candidate", { candidate: event.candidate });
      }
    };
  };

  const handleOffer = (data: any) => {
    alert(data);
    if (peerConnectionRef.current) {
      peerConnectionRef.current
        .setRemoteDescription(new RTCSessionDescription(data.offer))
        .then(() => {
          return peerConnectionRef.current?.createAnswer();
        })
        .then((answer) => {
          return peerConnectionRef.current?.setLocalDescription(answer);
        })
        .then(() => {
          socket.emit("answer", {
            answer: peerConnectionRef.current?.localDescription,
          });
        });
    }
  };

  const handleAnswer = (data: any) => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.setRemoteDescription(
        new RTCSessionDescription(data.answer)
      );
    }
  };

  const handleNewICECandidate = (data: any) => {
    const candidate = new RTCIceCandidate(data.candidate);
    if (peerConnectionRef.current) {
      peerConnectionRef.current.addIceCandidate(candidate);
    }
  };

  return (
    <div>
      <div>
        <button
          onClick={startCall}
          disabled={isCallStarted}
          style={{ border: "1px solid black" }}
        >
          Start Call
        </button>
      </div>
      <div>
        <video
          ref={localVideoRef}
          autoPlay
          muted
          style={{ width: "300px", height: "300px", border: "1px solid black" }}
        ></video>
        <video
          ref={remoteVideoRef}
          autoPlay
          style={{ width: "300px", height: "300px", border: "1px solid black" }}
        ></video>
      </div>
    </div>
  );
};

export default VideoCall;
