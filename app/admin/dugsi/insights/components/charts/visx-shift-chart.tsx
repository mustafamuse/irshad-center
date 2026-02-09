'use client'

import { useMemo } from 'react'

import { AxisBottom, AxisLeft } from '@visx/axis'
import { GridRows } from '@visx/grid'
import { Group } from '@visx/group'
import { ParentSize } from '@visx/responsive'
import { scaleBand, scaleLinear } from '@visx/scale'
import { Bar } from '@visx/shape'
import { useTooltip, TooltipWithBounds } from '@visx/tooltip'

import {
  CHART_MARGINS,
  ChartGradients,
  TooltipContainer,
} from './visx-primitives'

interface VisxShiftChartProps {
  morning: number
  afternoon: number
}

interface ShiftDatum {
  label: string
  count: number
  gradientId: string
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
    <div className="relative">
      <svg width={width} height={height}>
        <ChartGradients />
        <rect width={width} height={height} fill="url(#grad-bg-warm)" rx={14} />
        <Group left={CHART_MARGINS.left} top={CHART_MARGINS.top}>
          <GridRows
            scale={yScale}
            width={xMax}
            stroke="white"
            strokeOpacity={0.08}
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
                fill={`url(#${d.gradientId})`}
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
              fill: 'rgba(255,255,255,0.6)',
              fontSize: 12,
              textAnchor: 'middle' as const,
            }}
          />
          <AxisLeft
            scale={yScale}
            tickStroke="transparent"
            stroke="transparent"
            tickLabelProps={{
              fill: 'rgba(255,255,255,0.6)',
              fontSize: 12,
              textAnchor: 'end' as const,
              dx: -4,
            }}
            numTicks={5}
          />
        </Group>
      </svg>
      {tooltipOpen && tooltipData && (
        <TooltipWithBounds
          left={tooltipLeft}
          top={tooltipTop}
          unstyled
          applyPositionStyle
        >
          <TooltipContainer>
            <p className="font-medium">{tooltipData.label}</p>
            <p className="text-white/70">{tooltipData.count} students</p>
          </TooltipContainer>
        </TooltipWithBounds>
      )}
    </div>
  )
}

export function VisxShiftChart({ morning, afternoon }: VisxShiftChartProps) {
  const data: ShiftDatum[] = useMemo(
    () => [
      { label: 'Morning', count: morning, gradientId: 'grad-gold' },
      { label: 'Afternoon', count: afternoon, gradientId: 'grad-teal' },
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
