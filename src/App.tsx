import { Whiteboard } from './components/Whiteboard/Whiteboard';
import { CenterPeak } from './components/CenterPeak/CenterPeak';
import { NotificationProvider } from './components/Notification/NotificationContext';
import { useUpdateCheck } from './hooks/useUpdateCheck';

const MainLayout = () => {
  useUpdateCheck();

  return (
    <>
      <Whiteboard />
      <CenterPeak />
    </>
  );
};

function App() {
  return (
    <NotificationProvider>
      <MainLayout />
    </NotificationProvider>
  );
}

export default App;
