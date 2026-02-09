'use client'

import { useMemo } from 'react'

import { AxisBottom, AxisLeft } from '@visx/axis'
import { GridRows } from '@visx/grid'
import { ParentSize } from '@visx/responsive'
import { scaleBand, scaleLinear } from '@visx/scale'
import { Bar } from '@visx/shape'
import { useTooltip, TooltipWithBounds } from '@visx/tooltip'

import {
  BRAND_COLORS,
  CHART_MARGINS,
  TooltipContainer,
} from './visx-primitives'

interface VisxShiftChartProps {
  morning: number
  afternoon: number
}

interface ShiftDatum {
  label: string
  count: number
  color: string
}

function ShiftBarChart({
  width,
  height,
  data,
}: {
  width: number
  height: number
  data: ShiftDatum[]
}) {
  const {
    showTooltip,
    hideTooltip,
    tooltipOpen,
    tooltipData,
    tooltipLeft,
    tooltipTop,
  } = useTooltip<ShiftDatum>()

  const xMax = width - CHART_MARGINS.left - CHART_MARGINS.right
  const yMax = height - CHART_MARGINS.top - CHART_MARGINS.bottom

  const xScale = useMemo(
    () =>
      scaleBand<string>({
        domain: data.map((d) => d.label),
        range: [0, xMax],
        padding: 0.4,
      }),
    [data, xMax]
  )

  const yScale = useMemo(
    () =>
      scaleLinear<number>({
        domain: [0, Math.max(...data.map((d) => d.count), 1)],
        range: [yMax, 0],
        nice: true,
      }),
    [data, yMax]
  )

  if (width < 100) return null

  return (
    <div style={{ position: 'relative' }}>
      <svg width={width} height={height}>
        <g transform={`translate(${CHART_MARGINS.left},${CHART_MARGINS.top})`}>
          <GridRows
            scale={yScale}
            width={xMax}
            stroke="#e5e7eb"
            strokeOpacity={0.5}
          />
          {data.map((d) => {
            const barX = xScale(d.label) ?? 0
            const barWidth = xScale.bandwidth()
            const barHeight = yMax - (yScale(d.count) ?? 0)
            const barY = yScale(d.count) ?? 0

            return (
              <Bar
                key={d.label}
                x={barX}
                y={barY}
                width={barWidth}
                height={barHeight}
                fill={d.color}
                rx={4}
                onMouseMove={() => {
                  showTooltip({
                    tooltipData: d,
                    tooltipLeft: barX + barWidth / 2 + CHART_MARGINS.left,
                    tooltipTop: barY + CHART_MARGINS.top,
                  })
                }}
                onMouseLeave={() => hideTooltip()}
              />
            )
          })}
          <AxisBottom
            top={yMax}
            scale={xScale}
            tickStroke="transparent"
            stroke="transparent"
            tickLabelProps={{
              fill: '#6b7280',
              fontSize: 12,
              textAnchor: 'middle' as const,
            }}
          />
          <AxisLeft
            scale={yScale}
            tickStroke="transparent"
            stroke="transparent"
            tickLabelProps={{
              fill: '#6b7280',
              fontSize: 12,
              textAnchor: 'end' as const,
              dx: -4,
            }}
            numTicks={5}
          />
        </g>
      </svg>
      {tooltipOpen && tooltipData && (
        <TooltipWithBounds left={tooltipLeft} top={tooltipTop}>
          <TooltipContainer>
            <p className="font-medium">{tooltipData.label}</p>
            <p className="text-muted-foreground">
              {tooltipData.count} students
            </p>
          </TooltipContainer>
        </TooltipWithBounds>
      )}
    </div>
  )
}

export function VisxShiftChart({ morning, afternoon }: VisxShiftChartProps) {
  const data: ShiftDatum[] = useMemo(
    () => [
      { label: 'Morning', count: morning, color: BRAND_COLORS.gold },
      { label: 'Afternoon', count: afternoon, color: BRAND_COLORS.teal },
    ],
    [morning, afternoon]
  )

  return (
    <div style={{ minHeight: 250, width: '100%' }}>
      <ParentSize>
        {({ width, height }) => (
          <ShiftBarChart
            width={width}
            height={Math.max(height, 250)}
            data={data}
          />
        )}
      </ParentSize>
    </div>
  )
}
