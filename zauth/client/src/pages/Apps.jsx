import React from 'react';
import { Box, Typography, Grid, Card, CardContent, CardActionArea } from '@mui/material';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import PersonIcon from '@mui/icons-material/Person';
import SettingsIcon from '@mui/icons-material/Settings';
import SecurityIcon from '@mui/icons-material/Security';
import StorageIcon from '@mui/icons-material/Storage';
import HistoryIcon from '@mui/icons-material/History';
import NotificationsIcon from '@mui/icons-material/Notifications';
import DevicesIcon from '@mui/icons-material/Devices';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import BackupIcon from '@mui/icons-material/Backup';
import ShareIcon from '@mui/icons-material/Share';
import SyncIcon from '@mui/icons-material/Sync';
import WorkspacesIcon from '@mui/icons-material/Workspaces';

// Utility apps data
const apps = [
  {
    id: 1,
    name: 'Secret Maps',
    description: 'Private location tracking with zero-knowledge proofs',
    icon: <LocationOnIcon sx={{ fontSize: 48 }} />,
    path: '/secret-maps',
    color: '#0E8388'
  },
  {
    id: 2,
    name: 'Profile',
    description: 'Manage your account settings and preferences',
    icon: <PersonIcon sx={{ fontSize: 48 }} />,
    path: '/profile',
    color: '#2E4F4F'
  },
  {
    id: 3,
    name: 'Settings',
    description: 'Configure your application preferences',
    icon: <SettingsIcon sx={{ fontSize: 48 }} />,
    path: '/settings',
    color: '#2C3333'
  },
  {
    id: 4,
    name: 'Security',
    description: 'Manage your security settings and 2FA',
    icon: <SecurityIcon sx={{ fontSize: 48 }} />,
    path: '/security',
    color: '#3a4242'
  },
  {
    id: 5,
    name: 'Storage',
    description: 'Access and manage your encrypted storage',
    icon: <StorageIcon sx={{ fontSize: 48 }} />,
    path: '/storage',
    color: '#4d5757'
  },
  {
    id: 6,
    name: 'Activity',
    description: 'View your recent activity and sessions',
    icon: <HistoryIcon sx={{ fontSize: 48 }} />,
    path: '/activity',
    color: '#0E8388'
  },
  {
    id: 7,
    name: 'Notifications',
    description: 'Configure your notification preferences',
    icon: <NotificationsIcon sx={{ fontSize: 48 }} />,
    path: '/notifications',
    color: '#2E4F4F'
  },
  {
    id: 8,
    name: 'Devices',
    description: 'Manage your connected devices',
    icon: <DevicesIcon sx={{ fontSize: 48 }} />,
    path: '/devices',
    color: '#2C3333'
  },
  {
    id: 9,
    name: 'Analytics',
    description: 'View your usage statistics and insights',
    icon: <AnalyticsIcon sx={{ fontSize: 48 }} />,
    path: '/analytics',
    color: '#3a4242'
  },
  {
    id: 10,
    name: 'Backup',
    description: 'Manage your encrypted backups',
    icon: <BackupIcon sx={{ fontSize: 48 }} />,
    path: '/backup',
    color: '#0E8388'
  },
  {
    id: 11,
    name: 'Share',
    description: 'Securely share files and data',
    icon: <ShareIcon sx={{ fontSize: 48 }} />,
    path: '/share',
    color: '#2E4F4F'
  },
  {
    id: 12,
    name: 'Sync',
    description: 'Synchronize your data across devices',
    icon: <SyncIcon sx={{ fontSize: 48 }} />,
    path: '/sync',
    color: '#2C3333'
  },
];

function Apps() {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        width: '100vw',
        margin: 0,
        padding: 0,
        position: 'fixed',
        top: 0,
        left: 0,
        background: 'radial-gradient(circle at center, #2C3333 0%, #3a4242 50%, #4d5757 100%)',
        overflow: 'auto',
        pt: 8,
        pb: 4,
        px: 4,
      }}
    >
      <Typography
        variant="h4"
        component="h1"
        sx={{
          mb: 4,
          textAlign: 'center',
          color: 'white',
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
        }}
      >
        Applications
      </Typography>

      <Grid container spacing={3} justifyContent="center">
        {apps.map((app) => (
          <Grid item xs={12} sm={6} md={4} lg={3} key={app.id}>
            <Card 
              sx={{ 
                background: 'rgba(255, 255, 255, 0.05)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                transition: 'all 0.3s ease',
                height: '100%',
                '&:hover': {
                  transform: 'translateY(-8px)',
                  boxShadow: '0 12px 20px rgba(0, 0, 0, 0.2)',
                  border: `1px solid ${app.color}`,
                  '& .MuiSvgIcon-root': {
                    transform: 'scale(1.1)',
                    color: app.color
                  }
                }
              }}
            >
              <CardActionArea 
                component="a" 
                href={app.path}
                sx={{ height: '100%' }}
              >
                <CardContent sx={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center',
                  textAlign: 'center',
                  color: 'white',
                  p: 3
                }}>
                  <Box
                    sx={{
                      mb: 2,
                      transition: 'all 0.3s ease',
                      color: '#CBE4DE'
                    }}
                  >
                    {app.icon}
                  </Box>
                  <Typography 
                    variant="h6" 
                    sx={{ 
                      mb: 1,
                      fontWeight: 600,
                      letterSpacing: '0.5px'
                    }}
                  >
                    {app.name}
                  </Typography>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      opacity: 0.7,
                      lineHeight: 1.5
                    }}
                  >
                    {app.description}
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}

export default Apps; 