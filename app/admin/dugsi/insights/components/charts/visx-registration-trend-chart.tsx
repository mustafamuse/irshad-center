'use client'

import { AxisBottom, AxisLeft } from '@visx/axis'
import { curveMonotoneX } from '@visx/curve'
import { GridRows } from '@visx/grid'
import { Group } from '@visx/group'
import { ParentSize } from '@visx/responsive'
import { scaleBand, scaleLinear } from '@visx/scale'
import { Bar } from '@visx/shape'
import { LinePath } from '@visx/shape'
import { useTooltip, TooltipWithBounds } from '@visx/tooltip'

import type { RegistrationTrendItem } from '@/app/admin/dugsi/_types/insights'

import {
  BRAND_COLORS,
  CHART_MARGINS,
  TooltipContainer,
  ChartLegend,
} from './visx-primitives'

interface Props {
  data: RegistrationTrendItem[]
}

interface TooltipData {
  label: string
  studentCount: number
  familyCount: number
}

function Chart({
  data,
  width,
  height,
}: Props & { width: number; height: number }) {
  const {
    showTooltip,
    hideTooltip,
    tooltipData,
    tooltipLeft,
    tooltipTop,
    tooltipOpen,
  } = useTooltip<TooltipData>()

  const xMax = width - CHART_MARGINS.left - CHART_MARGINS.right
  const yMax = height - CHART_MARGINS.top - CHART_MARGINS.bottom

  const maxCount = Math.max(
    ...data.map((d) => Math.max(d.studentCount, d.familyCount)),
    1
  )

  const xScale = scaleBand<string>({
    domain: data.map((d) => d.label),
    range: [0, xMax],
    padding: 0.3,
  })

  const yScale = scaleLinear<number>({
    domain: [0, maxCount],
    range: [yMax, 0],
    nice: true,
  })

  const bandwidth = xScale.bandwidth()

  return (
    <div className="relative">
      <svg width={width} height={height}>
        <Group left={CHART_MARGINS.left} top={CHART_MARGINS.top}>
          <GridRows
            scale={yScale}
            width={xMax}
            stroke="currentColor"
            strokeOpacity={0.1}
            numTicks={5}
          />

          {data.map((d) => {
            const barX = xScale(d.label) ?? 0
            const barHeight = yMax - (yScale(d.studentCount) ?? 0)
            return (
              <Bar
                key={d.month}
                x={barX}
                y={yMax - barHeight}
                width={bandwidth}
                height={barHeight}
                fill={BRAND_COLORS.teal}
                rx={2}
                onMouseMove={() => {
                  showTooltip({
                    tooltipData: {
                      label: d.label,
                      studentCount: d.studentCount,
                      familyCount: d.familyCount,
                    },
                    tooltipLeft: CHART_MARGINS.left + barX + bandwidth / 2,
                    tooltipTop:
                      CHART_MARGINS.top + (yScale(d.studentCount) ?? 0),
                  })
                }}
                onMouseLeave={hideTooltip}
              />
            )
          })}

          <LinePath
            data={data}
            x={(d) => (xScale(d.label) ?? 0) + bandwidth / 2}
            y={(d) => yScale(d.familyCount) ?? 0}
            stroke={BRAND_COLORS.gold}
            strokeWidth={2}
            curve={curveMonotoneX}
          />

          {data.map((d) => (
            <circle
              key={`dot-${d.month}`}
              cx={(xScale(d.label) ?? 0) + bandwidth / 2}
              cy={yScale(d.familyCount) ?? 0}
              r={4}
              fill={BRAND_COLORS.gold}
              stroke="white"
              strokeWidth={1.5}
            />
          ))}

          <AxisBottom
            top={yMax}
            scale={xScale}
            tickLabelProps={{
              fontSize: 11,
              textAnchor: 'middle',
              fill: 'currentColor',
            }}
            stroke="currentColor"
            strokeWidth={0}
            tickStroke="transparent"
          />

          <AxisLeft
            scale={yScale}
            tickLabelProps={{
              fontSize: 11,
              textAnchor: 'end',
              fill: 'currentColor',
              dx: -4,
            }}
            stroke="currentColor"
            strokeWidth={0}
            tickStroke="transparent"
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
            <p style={{ color: BRAND_COLORS.teal }}>
              Students: {tooltipData.studentCount}
            </p>
            <p style={{ color: BRAND_COLORS.gold }}>
              Families: {tooltipData.familyCount}
            </p>
          </TooltipContainer>
        </TooltipWithBounds>
      )}
    </div>
  )
}

export function VisxRegistrationTrendChart({ data }: Props) {
  return (
    <div style={{ minHeight: 250 }}>
      <ParentSize>
        {({ width, height }) =>
          width > 0 && height > 0 ? (
            <Chart data={data} width={width} height={Math.max(height, 250)} />
          ) : null
        }
      </ParentSize>
      <ChartLegend
        items={[
          { label: 'Students', color: BRAND_COLORS.teal },
          { label: 'Families', color: BRAND_COLORS.gold },
        ]}
      />
    </div>
  )
}
