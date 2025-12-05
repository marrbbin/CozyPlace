import { useState, useEffect, useRef, useCallback } from 'react';
import Peer, { DataConnection } from 'peerjs';
import { Message, NetworkPayload, PeerState } from '../types';

// Generate a simpler, friendly room ID if none exists
const generateRoomId = () => {
  const adjs = ['cozy', 'warm', 'safe', 'calm', 'soft'];
  const nouns = ['nook', 'space', 'place', 'room', 'den'];
  const random = Math.floor(Math.random() * 1000);
  return `${adjs[Math.floor(Math.random() * adjs.length)]}-${nouns[Math.floor(Math.random() * nouns.length)]}-${random}`;
};

export const useP2PChat = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [peerState, setPeerState] = useState<PeerState>({
    myId: '',
    isHost: false,
    connections: [],
    status: 'loading',
  });

  const peerRef = useRef<Peer | null>(null);
  const connectionsRef = useRef<{ [key: string]: DataConnection }>({});
  const processedMessageIds = useRef<Set<string>>(new Set());
  const isHostRef = useRef(false);

  // Add message to local state
  const addMessage = useCallback((msg: Message) => {
    if (processedMessageIds.current.has(msg.id)) return;
    
    processedMessageIds.current.add(msg.id);
    setMessages((prev) => [...prev, msg]);
  }, []);

  // Send data helper
  const sendData = useCallback((data: NetworkPayload, targetConn?: DataConnection) => {
    if (targetConn) {
      targetConn.send(data);
    } else {
      Object.values(connectionsRef.current).forEach((c) => {
        const conn = c as DataConnection;
        if (conn.open) {
          conn.send(data);
        }
      });
    }
  }, []);

  const handleData = useCallback((data: unknown, sourcePeerId: string) => {
    const payload = data as NetworkPayload;
      
    if (payload.type === 'CHAT_MESSAGE') {
      const msg = payload.payload as Message;
      
      // Prevent duplicate processing
      if (processedMessageIds.current.has(msg.id)) return;
      
      addMessage({ ...msg, isSelf: false });

      // If Host, relay to others
      if (isHostRef.current) {
         Object.values(connectionsRef.current).forEach(c => {
           const conn = c as DataConnection;
           if (conn.peer !== sourcePeerId && conn.open) {
             conn.send(payload);
           }
         });
      }
    }
  }, [addMessage]);

  useEffect(() => {
    // 1. Get or Create Room ID
    let roomId = window.location.hash.replace('#', '');
    if (!roomId) {
      roomId = generateRoomId();
      window.location.hash = roomId;
    }

    console.log(`Attempting to join/host room: ${roomId}`);

    // 2. Try to be the Host first (Claim the Room ID)
    const peer = new Peer(roomId, {
      debug: 1,
    });

    peerRef.current = peer;

    // --- HOST SUCCESS FLOW ---
    peer.on('open', (id) => {
      console.log('Registered as Host with ID:', id);
      isHostRef.current = true;
      setPeerState({
        myId: id,
        isHost: true,
        connections: [],
        status: 'ready',
      });
    });

    // --- HOST FAILURE (ALREADY TAKEN) -> BECOME GUEST ---
    peer.on('error', (err: any) => {
      if (err.type === 'unavailable-id') {
        console.log('Room ID taken, joining as Guest...');
        peer.destroy(); // Destroy the failed host attempt
        
        // Create a random guest ID
        const guestPeer = new Peer({ debug: 1 });
        peerRef.current = guestPeer;

        guestPeer.on('open', (guestId) => {
          console.log('Registered as Guest with ID:', guestId);
          setPeerState(prev => ({ ...prev, myId: guestId, isHost: false }));
          
          // Connect to the Room Host
          const conn = guestPeer.connect(roomId, { reliable: true });
          
          conn.on('open', () => {
            console.log('Connected to Host');
            connectionsRef.current[roomId] = conn;
            setPeerState(prev => ({ 
              ...prev, 
              status: 'ready',
              connections: [roomId] 
            }));
          });

          conn.on('data', (data) => handleData(data, roomId));
          
          conn.on('close', () => {
            console.log('Host disconnected');
            setPeerState(prev => ({ ...prev, status: 'error', connections: [] }));
          });
          
          conn.on('error', (e) => console.error('Connection error:', e));
        });

      } else {
        console.error('Peer Error:', err);
        setPeerState(prev => ({ ...prev, status: 'error' }));
      }
    });

    // --- INCOMING CONNECTIONS (Only for Host) ---
    peer.on('connection', (conn) => {
      console.log('Incoming connection from:', conn.peer);
      
      conn.on('open', () => {
        connectionsRef.current[conn.peer] = conn;
        setPeerState(prev => ({
          ...prev,
          connections: Object.keys(connectionsRef.current)
        }));
      });

      conn.on('data', (data) => handleData(data, conn.peer));

      conn.on('close', () => {
        delete connectionsRef.current[conn.peer];
        setPeerState(prev => ({
          ...prev,
          connections: Object.keys(connectionsRef.current)
        }));
      });
    });

    return () => {
      peer.destroy();
    };
  }, [addMessage, handleData]);

  const sendMessage = (text: string) => {
    if (!text.trim()) return;

    const newMessage: Message = {
      id: Math.random().toString(36).substr(2, 9),
      text,
      senderId: peerState.myId,
      timestamp: Date.now(),
      isSelf: true,
      type: 'text',
    };

    addMessage(newMessage);
    
    sendData({
      type: 'CHAT_MESSAGE',
      payload: newMessage,
    });
  };

  return {
    messages,
    peerState,
    sendMessage,
  };
};