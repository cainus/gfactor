import * as React from 'react';
import { styles } from '../styles';
import { PatternOccurrence } from '../../utils/types';

interface ChartDataPoint {
  index: number;
  timestamp: string;
  count: number;
  file: string;
}

interface BurndownChartProps {
  occurrences: PatternOccurrence[];
}

export const BurndownChart: React.FC<BurndownChartProps> = ({ occurrences }) => {
  // Format data for the chart
  const chartData: ChartDataPoint[] = occurrences.map((occurrence, index) => {
    return {
      index,
      timestamp: occurrence.timestamp.toLocaleTimeString(),
      count: occurrence.count,
      file: occurrence.file || 'Initial scan'
    };
  });
  
  // Calculate chart dimensions
  const chartWidth = 800;
  const chartHeight = 400;
  const paddingLeft = 50;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 50;
  const graphWidth = chartWidth - paddingLeft - paddingRight;
  const graphHeight = chartHeight - paddingTop - paddingBottom;
  
  // Calculate scales
  const maxCount = Math.max(...occurrences.map(o => o.count));
  const yScale = graphHeight / maxCount;
  const xScale = graphWidth / (occurrences.length - 1 || 1);
  
  // Generate SVG path for the line
  let pathData = '';
  occurrences.forEach((occurrence, i) => {
    const x = paddingLeft + i * xScale;
    const y = paddingTop + graphHeight - (occurrence.count * yScale);
    if (i === 0) {
      pathData += `M ${x} ${y}`;
    } else {
      pathData += ` L ${x} ${y}`;
    }
  });

  // Generate Y-axis labels
  const yAxisLabels = Array.from({ length: 5 }, (_, i) => {
    const value = Math.round(maxCount * (4 - i) / 4);
    const y = paddingTop + i * (graphHeight / 4);
    return (
      <text 
        key={`y-label-${i}`}
        style={styles.chartLabel} 
        x={paddingLeft - 10} 
        y={y + 5} 
        textAnchor="end"
      >
        {value}
      </text>
    );
  });

  // Generate X-axis labels
  const xAxisLabels = occurrences.map((_, i) => {
    const x = paddingLeft + i * xScale;
    return (
      <text 
        key={`x-label-${i}`}
        style={styles.chartLabel} 
        x={x} 
        y={paddingTop + graphHeight + 20} 
        textAnchor="middle"
      >
        {i + 1}
      </text>
    );
  });

  // Generate data points
  const dataPoints = occurrences.map((occurrence, i) => {
    const x = paddingLeft + i * xScale;
    const y = paddingTop + graphHeight - (occurrence.count * yScale);
    return (
      <circle 
        key={`point-${i}`}
        style={styles.chartPoint} 
        cx={x} 
        cy={y} 
        r={4}
      />
    );
  });

  return (
    <div style={styles.body}>
      <h1>Pattern Burndown Chart</h1>
      <p>This chart shows the number of old patterns remaining over time during the refactoring process.</p>
      
      <div style={styles.chartContainer}>
        <svg style={styles.chartSvg} width={chartWidth} height={chartHeight}>
          {/* Y-axis */}
          <line 
            style={styles.axisLine} 
            x1={paddingLeft} 
            y1={paddingTop} 
            x2={paddingLeft} 
            y2={paddingTop + graphHeight}
          />
          
          {/* X-axis */}
          <line 
            style={styles.axisLine} 
            x1={paddingLeft} 
            y1={paddingTop + graphHeight} 
            x2={paddingLeft + graphWidth} 
            y2={paddingTop + graphHeight}
          />
          
          {/* Y-axis labels */}
          {yAxisLabels}
          
          {/* X-axis labels */}
          {xAxisLabels}
          
          {/* Chart line */}
          <path style={styles.chartLine} d={pathData} />
          
          {/* Data points */}
          {dataPoints}
          
          {/* Axis labels */}
          <text 
            style={styles.axisLabel} 
            x={paddingLeft - 35} 
            y={paddingTop + graphHeight / 2} 
            transform={`rotate(-90, ${paddingLeft - 35}, ${paddingTop + graphHeight / 2})`}
          >
            Patterns Remaining
          </text>
          <text 
            style={styles.axisLabel} 
            x={paddingLeft + graphWidth / 2} 
            y={paddingTop + graphHeight + 40}
          >
            Steps
          </text>
        </svg>
      </div>
      
      <h2>Data Points</h2>
      <table style={styles.dataTable}>
        <thead>
          <tr>
            <th style={{...styles.tableCell, ...styles.tableHeader}}>Step</th>
            <th style={{...styles.tableCell, ...styles.tableHeader}}>Time</th>
            <th style={{...styles.tableCell, ...styles.tableHeader}}>File</th>
            <th style={{...styles.tableCell, ...styles.tableHeader}}>Patterns Remaining</th>
          </tr>
        </thead>
        <tbody>
          {chartData.map(data => (
            <tr key={`row-${data.index}`}>
              <td style={styles.tableCell}>{data.index + 1}</td>
              <td style={styles.tableCell}>{data.timestamp}</td>
              <td style={styles.tableCell}>{data.file}</td>
              <td style={styles.tableCell}>{data.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};