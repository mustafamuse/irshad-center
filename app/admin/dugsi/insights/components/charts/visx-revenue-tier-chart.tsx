'use client'

import { AxisBottom, AxisLeft } from '@visx/axis'
import { GridRows } from '@visx/grid'
import { Group } from '@visx/group'
import { ParentSize } from '@visx/responsive'
import { scaleBand, scaleLinear } from '@visx/scale'
import { Bar } from '@visx/shape'
import { useTooltip, TooltipWithBounds } from '@visx/tooltip'

import type { RevenueByTier } from '@/app/admin/dugsi/_types/insights'
import { formatCentsWhole } from '@/app/admin/dugsi/_utils/format'

import {
  BRAND_COLORS,
  CHART_MARGINS,
  TooltipContainer,
  ChartLegend,
} from './visx-primitives'

interface Props {
  data: RevenueByTier[]
}

const keys = ['expected', 'actual'] as const
const colorMap = { expected: BRAND_COLORS.teal, actual: BRAND_COLORS.gold }

interface TierTooltip {
  tier: string
  expected: number
  actual: number
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
  } = useTooltip<TierTooltip>()

  const xMax = width - CHART_MARGINS.left - CHART_MARGINS.right
  const yMax = height - CHART_MARGINS.top - CHART_MARGINS.bottom

  const tierScale = scaleBand<string>({
    domain: data.map((d) => d.tier),
    range: [0, xMax],
    padding: 0.3,
  })

  const groupScale = scaleBand<string>({
    domain: [...keys],
    range: [0, tierScale.bandwidth()],
    padding: 0.1,
  })

  const maxValue = Math.max(
    ...data.flatMap((d) => [d.expectedRevenue, d.actualRevenue]),
    0
  )

  const valueScale = scaleLinear<number>({
    domain: [0, maxValue * 1.1],
    range: [yMax, 0],
    nice: true,
  })

  return (
    <div style={{ position: 'relative' }}>
      <svg width={width} height={height}>
        <Group left={CHART_MARGINS.left} top={CHART_MARGINS.top}>
          <GridRows
            scale={valueScale}
            width={xMax}
            strokeDasharray="3,3"
            stroke="#e5e7eb"
            strokeOpacity={0.6}
          />
          {data.map((d) => {
            const tierX = tierScale(d.tier) ?? 0
            return (
              <Group key={d.tier} left={tierX}>
                {keys.map((key) => {
                  const value =
                    key === 'expected' ? d.expectedRevenue : d.actualRevenue
                  const barX = groupScale(key) ?? 0
                  const barHeight = yMax - (valueScale(value) ?? 0)
                  const barY = valueScale(value) ?? 0
                  return (
                    <Bar
                      key={key}
                      x={barX}
                      y={barY}
                      width={groupScale.bandwidth()}
                      height={Math.max(barHeight, 0)}
                      fill={colorMap[key]}
                      rx={2}
                      onMouseMove={() => {
                        showTooltip({
                          tooltipData: {
                            tier: d.tier,
                            expected: d.expectedRevenue,
                            actual: d.actualRevenue,
                          },
                          tooltipLeft:
                            tierX +
                            CHART_MARGINS.left +
                            barX +
                            groupScale.bandwidth() / 2,
                          tooltipTop: barY + CHART_MARGINS.top,
                        })
                      }}
                      onMouseLeave={hideTooltip}
                    />
                  )
                })}
              </Group>
            )
          })}
          <AxisBottom
            top={yMax}
            scale={tierScale}
            tickLabelProps={{
              fontSize: 11,
              textAnchor: 'middle',
              fill: '#6b7280',
            }}
            hideTicks
            hideAxisLine
          />
          <AxisLeft
            scale={valueScale}
            tickFormat={(v) => formatCentsWhole(v as number)}
            tickLabelProps={{
              fontSize: 11,
              textAnchor: 'end',
              fill: '#6b7280',
              dx: -4,
            }}
            hideTicks
            hideAxisLine
            numTicks={5}
          />
        </Group>
      </svg>
      {tooltipOpen && tooltipData && (
        <TooltipWithBounds
          left={tooltipLeft}
          top={tooltipTop}
          style={{ position: 'absolute' }}
        >
          <TooltipContainer>
            <p className="font-medium">{tooltipData.tier}</p>
            <p>Expected: {formatCentsWhole(tooltipData.expected)}</p>
            <p>Actual: {formatCentsWhole(tooltipData.actual)}</p>
          </TooltipContainer>
        </TooltipWithBounds>
      )}
    </div>
  )
}

export function VisxRevenueTierChart({ data }: Props) {
  return (
    <div>
      <div style={{ minHeight: 250 }}>
        <ParentSize>
          {({ width, height }) =>
            width > 0 && height > 0 ? (
              <Chart data={data} width={width} height={Math.max(height, 250)} />
            ) : null
          }
        </ParentSize>
      </div>
      <ChartLegend
        items={[
          { label: 'Expected', color: BRAND_COLORS.teal },
          { label: 'Actual', color: BRAND_COLORS.gold },
        ]}
      />
    </div>
  )
}
