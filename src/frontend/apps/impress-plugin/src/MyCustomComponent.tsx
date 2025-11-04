import React, { useState, useRef, useEffect } from 'react';
import { Button, Popover } from 'react-aria-components';
import styled from 'styled-components';
import { useTranslation } from 'react-i18next';
import { useAuthQuery } from 'impress/features/auth/api';
import { Icon, Loading, Box, Text } from 'impress/components';

// Styled Components showcasing styled-components integration
const StyledButton = styled(Button)`
  cursor: pointer;
  border: 1px solid #0066cc;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 8px 16px;
  border-radius: 8px;
  font-family: Marianne, Arial, serif;
  font-weight: 500;
  font-size: 0.875rem;
  transition: all 0.2s ease-in-out;
  display: flex;
  align-items: center;
  gap: 8px;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
  }

  &:active {
    transform: translateY(0);
  }

  &:focus-visible {
    outline: 2px solid #667eea;
    outline-offset: 2px;
  }
`;

const StyledPopover = styled(Popover)`
  background-color: white;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
  border: 1px solid #e0e0e0;
  min-width: 400px;
  max-width: 500px;
  max-height: 600px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

const TabContainer = styled.div`
  display: flex;
  border-bottom: 2px solid #f0f0f0;
  background-color: #fafafa;
`;

const Tab = styled.button<{ $active: boolean }>`
  flex: 1;
  padding: 12px 16px;
  border: none;
  background: ${props => props.$active ? 'white' : 'transparent'};
  color: ${props => props.$active ? '#667eea' : '#666'};
  font-weight: ${props => props.$active ? '600' : '400'};
  font-size: 0.875rem;
  cursor: pointer;
  border-bottom: 2px solid ${props => props.$active ? '#667eea' : 'transparent'};
  margin-bottom: -2px;
  transition: all 0.2s ease-in-out;

  &:hover {
    background-color: ${props => props.$active ? 'white' : '#f5f5f5'};
    color: ${props => props.$active ? '#667eea' : '#333'};
  }
`;

const TabContent = styled.div`
  padding: 20px;
  overflow-y: auto;
  max-height: 500px;
`;

const InfoCard = styled.div`
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
  border-left: 4px solid #667eea;
`;

const InfoRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);

  &:last-child {
    border-bottom: none;
  }
`;

const Label = styled.span`
  font-weight: 600;
  color: #333;
  font-size: 0.875rem;
`;

const Value = styled.span`
  color: #666;
  font-size: 0.875rem;
  font-family: 'Courier New', monospace;
  background-color: rgba(0, 0, 0, 0.05);
  padding: 2px 8px;
  border-radius: 4px;
`;

const FeatureList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
`;

const FeatureItem = styled.li`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px;
  margin-bottom: 8px;
  background-color: #f9f9f9;
  border-radius: 6px;
  transition: background-color 0.2s ease-in-out;

  &:hover {
    background-color: #f0f0f0;
  }
`;

interface ComponentProps {
  customMessage?: string;
  showDebugInfo?: boolean;
}

const MyCustomComponent: React.FC<ComponentProps> = ({ 
  customMessage = 'Plugin Showcase',
  showDebugInfo = true 
}) => {
  const { t, i18n } = useTranslation();
  const { data: authData, isLoading: authLoading } = useAuthQuery();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'user' | 'features' | 'system' | 'routing'>('user');
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [currentPath, setCurrentPath] = useState<string>('');
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Get current pathname from window.location (works in plugins)
  useEffect(() => {
    setCurrentPath(window.location.pathname);
    
    // Listen for route changes via popstate
    const handleRouteChange = () => {
      setCurrentPath(window.location.pathname);
    };
    
    window.addEventListener('popstate', handleRouteChange);
    return () => window.removeEventListener('popstate', handleRouteChange);
  }, []);

  const handleButtonPress = () => {
    if (!isOpen) {
      // Simulate a loading state when opening
      setLoadingDemo(true);
      setTimeout(() => {
        setLoadingDemo(false);
      }, 800);
    }
    setIsOpen(!isOpen);
  };

  // Derive authenticated from authData
  const authenticated = !!authData?.id;

  // Example of accessing host features
  const userFeatures = [
    { icon: 'person', label: 'Authentication', value: authenticated ? 'Active' : 'Inactive' },
    { icon: 'language', label: 'Language', value: i18n.language || 'en' },
    { icon: 'email', label: 'User Email', value: authData?.email || 'N/A' },
    { icon: 'badge', label: 'User ID', value: authData?.id || 'N/A' },
  ];

  const systemFeatures = [
    { icon: 'check_circle', label: 'React Hook (useAuthQuery)', enabled: true },
    { icon: 'check_circle', label: 'Window Location API', enabled: true },
    { icon: 'check_circle', label: 'PopState Events', enabled: true },
    { icon: 'check_circle', label: 'i18next Integration', enabled: true },
    { icon: 'check_circle', label: 'styled-components', enabled: true },
    { icon: 'check_circle', label: 'react-aria-components', enabled: true },
    { icon: 'check_circle', label: 'Host UI Components', enabled: true },
    { icon: 'check_circle', label: '@tanstack/react-query', enabled: true },
  ];

  const pluginCapabilities = [
    'Access authentication state from host',
    'Use host UI components (Icon, Box, Text, Loading)',
    'Leverage host hooks and utilities (useAuthQuery)',
    'Read current route via window.location',
    'Listen to route changes via popstate events',
    'Integrate with i18n for translations',
    'Use styled-components for styling',
    'Implement accessible UI with react-aria',
    'Receive props from plugin configuration',
    'React to route changes via visibility config',
  ];

  const renderUserTab = () => (
    <TabContent>
      <InfoCard>
        <Text $weight="bold" $size="l" style={{ marginBottom: '12px', display: 'block' }}>
          {t('User Information')}
        </Text>
        {authLoading ? (
          <Box $align="center" $justify="center" $padding="medium">
            <Loading />
          </Box>
        ) : (
          <>
            {userFeatures.map((feature, idx) => (
              <InfoRow key={idx}>
                <Label>
                  <Icon iconName={feature.icon} $size="s" style={{ marginRight: '8px' }} />
                  {feature.label}
                </Label>
                <Value>{feature.value}</Value>
              </InfoRow>
            ))}
          </>
        )}
      </InfoCard>

      {showDebugInfo && authData && (
        <InfoCard>
          <Text $weight="bold" $size="m" style={{ marginBottom: '8px', display: 'block' }}>
            Raw Auth Data
          </Text>
          <pre style={{ 
            fontSize: '0.75rem', 
            overflow: 'auto',
            maxHeight: '200px',
            backgroundColor: 'rgba(0,0,0,0.05)',
            padding: '12px',
            borderRadius: '4px'
          }}>
            {JSON.stringify(authData, null, 2)}
          </pre>
        </InfoCard>
      )}
    </TabContent>
  );

  const renderFeaturesTab = () => (
    <TabContent>
      <Text $weight="bold" $size="l" style={{ marginBottom: '16px', display: 'block' }}>
        {t('Plugin Capabilities')}
      </Text>
      <FeatureList>
        {pluginCapabilities.map((capability, idx) => (
          <FeatureItem key={idx}>
            <Icon iconName="check_circle" variant="filled" $color="#4caf50" />
            <Text $size="s">{capability}</Text>
          </FeatureItem>
        ))}
      </FeatureList>

      <InfoCard style={{ marginTop: '20px' }}>
        <Text $weight="bold" $size="m" style={{ marginBottom: '12px', display: 'block' }}>
          Props from Config
        </Text>
        <InfoRow>
          <Label>Custom Message</Label>
          <Value>{customMessage}</Value>
        </InfoRow>
        <InfoRow>
          <Label>Debug Mode</Label>
          <Value>{showDebugInfo ? 'Enabled' : 'Disabled'}</Value>
        </InfoRow>
      </InfoCard>
    </TabContent>
  );

  const renderSystemTab = () => (
    <TabContent>
      <Text $weight="bold" $size="l" style={{ marginBottom: '16px', display: 'block' }}>
        {t('Integrated Host Features')}
      </Text>
      <FeatureList>
        {systemFeatures.map((feature, idx) => (
          <FeatureItem key={idx}>
            <Icon 
              iconName={feature.enabled ? 'check_circle' : 'cancel'} 
              variant="filled" 
              $color={feature.enabled ? '#4caf50' : '#f44336'}
            />
            <Text $size="s">{feature.label}</Text>
          </FeatureItem>
        ))}
      </FeatureList>

      <InfoCard style={{ marginTop: '20px' }}>
        <Text $weight="bold" $size="m" style={{ marginBottom: '12px', display: 'block' }}>
          Available Host Components
        </Text>
        <Text $size="xs" style={{ lineHeight: '1.6' }}>
          Icon, Loading, Box, Text, Link, Card, Modal, DropButton, DropdownMenu, 
          InfiniteScroll, QuickSearch, Separators, TextErrors, and more...
        </Text>
      </InfoCard>
    </TabContent>
  );

  const renderRoutingTab = () => (
    <TabContent>
      <Text $weight="bold" $size="l" style={{ marginBottom: '16px', display: 'block' }}>
        {t('Route Information (Plugin-Safe)')}
      </Text>
      
      <InfoCard>
        <Text $weight="bold" $size="m" style={{ marginBottom: '12px', display: 'block' }}>
          Current Route Information
        </Text>
        <InfoRow>
          <Label>
            <Icon iconName="route" $size="s" style={{ marginRight: '8px' }} />
            Current Path
          </Label>
          <Value>{currentPath || '/'}</Value>
        </InfoRow>
        <InfoRow>
          <Label>
            <Icon iconName="link" $size="s" style={{ marginRight: '8px' }} />
            Full URL
          </Label>
          <Value style={{ fontSize: '0.75rem', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {typeof window !== 'undefined' ? window.location.href : 'N/A'}
          </Value>
        </InfoRow>
        <InfoRow>
          <Label>
            <Icon iconName="tag" $size="s" style={{ marginRight: '8px' }} />
            URL Hash
          </Label>
          <Value>{typeof window !== 'undefined' ? (window.location.hash || 'none') : 'N/A'}</Value>
        </InfoRow>
      </InfoCard>

      <InfoCard>
        <Text $weight="bold" $size="m" style={{ marginBottom: '12px', display: 'block' }}>
          Plugin Routing Capabilities
        </Text>
        <FeatureList>
          <FeatureItem>
            <Icon iconName="check_circle" variant="filled" $color="#4caf50" />
            <Text $size="s">Read pathname via window.location</Text>
          </FeatureItem>
          <FeatureItem>
            <Icon iconName="check_circle" variant="filled" $color="#4caf50" />
            <Text $size="s">Listen to popstate events for route changes</Text>
          </FeatureItem>
          <FeatureItem>
            <Icon iconName="check_circle" variant="filled" $color="#4caf50" />
            <Text $size="s">Use visibility.routes in config for conditional rendering</Text>
          </FeatureItem>
          <FeatureItem>
            <Icon iconName="info" variant="filled" $color="#2196f3" />
            <Text $size="s">Navigate using standard anchor tags or window APIs</Text>
          </FeatureItem>
          <FeatureItem>
            <Icon iconName="warning" variant="filled" $color="#ff9800" />
            <Text $size="s">Next.js router hooks not available (outside RouterContext)</Text>
          </FeatureItem>
        </FeatureList>
      </InfoCard>

      <InfoCard style={{ background: 'linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)', borderLeft: '4px solid #ff9800' }}>
        <Text $weight="bold" $size="s" style={{ marginBottom: '8px', display: 'block' }}>
          ⚠️ Important Note
        </Text>
        <Text $size="xs" style={{ lineHeight: '1.6', marginBottom: '8px' }}>
          Plugins render outside the Next.js RouterContext, so useRouter() and usePathname() 
          are not available. Instead, use:
        </Text>
        <ul style={{ fontSize: '0.75rem', lineHeight: '1.8', marginLeft: '20px' }}>
          <li><code>window.location.pathname</code> - Get current path</li>
          <li><code>window.addEventListener('popstate')</code> - Detect route changes</li>
          <li>Plugin config <code>visibility.routes</code> - Control when plugin appears</li>
        </ul>
      </InfoCard>

      <InfoCard style={{ background: 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)', borderLeft: '4px solid #4caf50' }}>
        <Text $weight="bold" $size="s" style={{ marginBottom: '8px', display: 'block' }}>
          ✅ Best Practice
        </Text>
        <Text $size="xs" style={{ lineHeight: '1.6' }}>
          For route-aware plugins, use the <code>visibility.routes</code> config option with 
          glob patterns (e.g., <code>["/docs/*", "!/docs/secret"]</code>). The plugin system 
          automatically shows/hides your plugin based on the current route!
        </Text>
      </InfoCard>
    </TabContent>
  );

  if (authLoading) {
    return (
      <Box $padding="small">
        <Loading />
      </Box>
    );
  }

  return (
    <>
      <StyledButton
        ref={triggerRef}
        onPress={handleButtonPress}
        aria-label="Open Plugin Showcase"
        aria-expanded={isOpen}
      >
        <Icon iconName="extension" variant="filled" />
        {customMessage}
      </StyledButton>

      <StyledPopover
        triggerRef={triggerRef}
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        offset={10}
      >
        {loadingDemo ? (
          <Box 
            $padding="large" 
            $align="center" 
            $justify="center" 
            $height="300px"
          >
            <Loading />
            <Text $size="s" style={{ marginTop: '16px', color: '#666' }}>
              Loading plugin data...
            </Text>
          </Box>
        ) : (
          <>
            <TabContainer>
              <Tab 
                $active={activeTab === 'user'} 
                onClick={() => setActiveTab('user')}
              >
                <Icon iconName="person" $size="s" /> User
              </Tab>
              <Tab 
                $active={activeTab === 'features'} 
                onClick={() => setActiveTab('features')}
              >
                <Icon iconName="settings" $size="s" /> Features
              </Tab>
              <Tab 
                $active={activeTab === 'system'} 
                onClick={() => setActiveTab('system')}
              >
                <Icon iconName="integration_instructions" $size="s" /> System
              </Tab>
              <Tab 
                $active={activeTab === 'routing'} 
                onClick={() => setActiveTab('routing')}
              >
                <Icon iconName="route" $size="s" /> Routing
              </Tab>
            </TabContainer>

            {activeTab === 'user' && renderUserTab()}
            {activeTab === 'features' && renderFeaturesTab()}
            {activeTab === 'system' && renderSystemTab()}
            {activeTab === 'routing' && renderRoutingTab()}
          </>
        )}
      </StyledPopover>
    </>
  );
};

export default MyCustomComponent;
