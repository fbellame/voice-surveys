import { useNavigate, useSearchParams } from 'react-router-dom';
import { AudioRoom } from '@/components/audio/AudioRoom';

const Room = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const roomName = searchParams.get('room') || undefined;
  const userName = searchParams.get('user') || undefined;
  const autoJoin = searchParams.get('autoJoin') === 'true';

  const handleLeave = () => {
    navigate('/');
  };

  return (
    <AudioRoom
      onLeave={handleLeave}
      autoJoin={autoJoin}
      defaultRoomName={roomName}
      defaultUserName={userName}
    />
  );
};

export default Room;