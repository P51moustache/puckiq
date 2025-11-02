// Example of how to refactor your current components using the design system

import React from 'react';
import { ScrollView, View } from 'react-native';
import { Button } from '../components/design-system/Button';
import { Card } from '../components/design-system/Card';
import { Typography } from '../components/design-system/Typography';
import { makeStyles } from '../constants/theme';

export function ExampleRefactoredScreen() {
  const styles = makeStyles();
  
  return (
    <ScrollView style={styles.container}>
      <View style={styles.scrollContainer}>
        
        {/* Page Header */}
        <Typography variant="h1" align="center">
          PuckIQ
        </Typography>
        
        <Typography variant="body" color="#98a6bf" align="center">
          Professional Hockey Analytics
        </Typography>
        
        {/* Stats Cards */}
        <Card variant="elevated" padding="lg">
          <Typography variant="h3">Team Performance</Typography>
          <Typography variant="caption" color="#98a6bf">
            Last 10 games
          </Typography>
          
          {/* Your existing stat content */}
          <View style={{ marginTop: 16 }}>
            <Typography variant="h2" color="#60a5fa">
              7-3-0
            </Typography>
            <Typography variant="caption">
              Win-Loss-OT
            </Typography>
          </View>
        </Card>
        
        {/* Action Buttons */}
        <View style={{ gap: 12, marginTop: 24 }}>
          <Button 
            title="View Team Stats" 
            onPress={() => {}} 
            variant="primary"
          />
          <Button 
            title="Player Analysis" 
            onPress={() => {}} 
            variant="outline"
          />
        </View>
        
        {/* Info Cards Grid */}
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
          <Card style={{ flex: 1 }} padding="md">
            <Typography variant="overline" color="#98a6bf">
              GOALS
            </Typography>
            <Typography variant="h2" color="#60a5fa">
              127
            </Typography>
          </Card>
          
          <Card style={{ flex: 1 }} padding="md">
            <Typography variant="overline" color="#98a6bf">
              ASSISTS
            </Typography>
            <Typography variant="h2" color="#60a5fa">
              89
            </Typography>
          </Card>
        </View>
        
      </View>
    </ScrollView>
  );
}

// This shows how your existing styles work with new design system components
// You keep your working colors and add professional structure