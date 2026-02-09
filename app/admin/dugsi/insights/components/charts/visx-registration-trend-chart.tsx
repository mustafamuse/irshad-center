'use client'

import { AxisBottom, AxisLeft } from '@visx/axis'
import { curveMonotoneX } from '@visx/curve'
import { GridRows } from '@visx/grid'
import { Group } from '@visx/group'
import { ParentSize } from '@visx/responsive'
import { scaleBand, scaleLinear } from '@visx/scale'
import { AreaClosed, Bar, LinePath } from '@visx/shape'
import { useTooltip, TooltipWithBounds } from '@visx/tooltip'

import type { RegistrationTrendItem } from '@/app/admin/dugsi/_types/insights'

import {
  BRAND_COLORS,
  CHART_MARGINS,
  ChartGradients,
  ChartLegend,
  TooltipContainer,
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
        <ChartGradients />
        <rect width={width} height={height} fill="url(#grad-bg-teal)" rx={14} />
        <Group left={CHART_MARGINS.left} top={CHART_MARGINS.top}>
          <GridRows
            scale={yScale}
            width={xMax}
            stroke="white"
            strokeOpacity={0.08}
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
                fill="url(#grad-teal)"
                opacity={0.7}
                rx={3}
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

          <AreaClosed
            data={data}
            x={(d) => (xScale(d.label) ?? 0) + bandwidth / 2}
            y={(d) => yScale(d.familyCount) ?? 0}
            yScale={yScale}
            fill="url(#grad-area)"
            curve={curveMonotoneX}
          />

          <LinePath
            data={data}
            x={(d) => (xScale(d.label) ?? 0) + bandwidth / 2}
            y={(d) => yScale(d.familyCount) ?? 0}
            stroke={BRAND_COLORS.goldLight}
            strokeWidth={2.5}
            curve={curveMonotoneX}
          />

          {data.map((d) => (
            <circle
              key={`dot-${d.month}`}
              cx={(xScale(d.label) ?? 0) + bandwidth / 2}
              cy={yScale(d.familyCount) ?? 0}
              r={4}
              fill={BRAND_COLORS.goldLight}
              stroke="white"
              strokeWidth={2}
            />
          ))}

          <AxisBottom
            top={yMax}
            scale={xScale}
            tickLabelProps={{
              fontSize: 11,
              textAnchor: 'middle' as const,
              fill: 'rgba(255,255,255,0.6)',
            }}
            stroke="transparent"
            tickStroke="transparent"
          />

          <AxisLeft
            scale={yScale}
            tickLabelProps={{
              fontSize: 11,
              textAnchor: 'end' as const,
              fill: 'rgba(255,255,255,0.6)',
              dx: -4,
            }}
            stroke="transparent"
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
            <p style={{ color: BRAND_COLORS.tealLight }}>
              Students: {tooltipData.studentCount}
            </p>
            <p style={{ color: BRAND_COLORS.goldLight }}>
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
    <div>
      <div style={{ minHeight: 250 }}>
        <ParentSize>
          {({ width, height }) =>
            width > 0 ? (
              <Chart data={data} width={width} height={Math.max(height, 250)} />
            ) : null
          }
        </ParentSize>
      </div>
      <ChartLegend
        items={[
          { label: 'Students', color: BRAND_COLORS.tealLight },
          { label: 'Families', color: BRAND_COLORS.goldLight },
        ]}
      />
    </div>
  )
}
