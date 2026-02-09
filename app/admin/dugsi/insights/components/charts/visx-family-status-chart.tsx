'use client'

import { useMemo, useState } from 'react'

import type { SubscriptionStatus } from '@prisma/client'
import { LinearGradient } from '@visx/gradient'
import { Group } from '@visx/group'
import { ParentSize } from '@visx/responsive'
import { Pie } from '@visx/shape'
import { Text } from '@visx/text'
import { useTooltip, TooltipWithBounds } from '@visx/tooltip'

import { TooltipContainer } from './visx-primitives'
import {
  STATUS_COLORS,
  STATUS_LABELS,
} from '../../../_constants/status-display'

interface VisxFamilyStatusChartProps {
  data: Record<SubscriptionStatus | 'none', number>
}

interface SliceDatum {
  status: SubscriptionStatus | 'none'
  count: number
}

export function VisxFamilyStatusChart({ data }: VisxFamilyStatusChartProps) {
  const { slices, total } = useMemo(() => {
    const entries = (
      Object.entries(data) as [SubscriptionStatus | 'none', number][]
    ).filter(([, count]) => count > 0)

    return {
      slices: entries.map(([status, count]) => ({ status, count })),
      total: entries.reduce((sum, [, c]) => sum + c, 0),
    }
  }, [data])

  const {
    tooltipOpen,
    tooltipLeft,
    tooltipTop,
    tooltipData,
    showTooltip,
    hideTooltip,
  } = useTooltip<SliceDatum>()

  const [activeStatus, setActiveStatus] = useState<string | null>(null)

  return (
    <div className="mx-auto aspect-square max-h-[250px]">
      <ParentSize>
        {({ width, height }) => {
          const radius = Math.min(width, height) / 2
          const innerRadius = radius * 0.6
          const outerRadius = radius * 0.88

          return (
            <div className="relative">
              <svg width={width} height={height}>
                <LinearGradient
                  id="grad-bg-donut"
                  from="#1e1b4b"
                  to="#0f172a"
                />
                <rect
                  width={width}
                  height={height}
                  fill="url(#grad-bg-donut)"
                  rx={14}
                />
                <Group top={height / 2} left={width / 2}>
                  <Pie
                    data={slices}
                    pieValue={(d) => d.count}
                    innerRadius={innerRadius}
                    outerRadius={outerRadius}
                    cornerRadius={3}
                    padAngle={0.02}
                  >
                    {(pie) =>
                      pie.arcs.map((arc) => {
                        const path = pie.path(arc) ?? ''
                        const isActive = activeStatus === arc.data.status
                        const baseColor = STATUS_COLORS[arc.data.status]
                        return (
                          <path
                            key={arc.data.status}
                            d={path}
                            fill={baseColor}
                            opacity={activeStatus && !isActive ? 0.3 : 0.85}
                            stroke="rgba(255,255,255,0.15)"
                            strokeWidth={1}
                            style={{ transition: 'opacity 150ms' }}
                            onMouseEnter={(e) => {
                              setActiveStatus(arc.data.status)
                              showTooltip({
                                tooltipData: arc.data,
                                tooltipLeft: e.clientX,
                                tooltipTop: e.clientY,
                              })
                            }}
                            onMouseMove={(e) => {
                              showTooltip({
                                tooltipData: arc.data,
                                tooltipLeft: e.clientX,
                                tooltipTop: e.clientY,
                              })
                            }}
                            onMouseLeave={() => {
                              setActiveStatus(null)
                              hideTooltip()
                            }}
                          />
                        )
                      })
                    }
                  </Pie>
                  <Text
                    textAnchor="middle"
                    verticalAnchor="middle"
                    dy={-8}
                    fill="white"
                    style={{ fontSize: 28, fontWeight: 700 }}
                  >
                    {total}
                  </Text>
                  <Text
                    textAnchor="middle"
                    verticalAnchor="middle"
                    dy={18}
                    fill="rgba(255,255,255,0.5)"
                    style={{ fontSize: 13 }}
                  >
                    Families
                  </Text>
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
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2.5 w-2.5 rounded-full"
                        style={{
                          backgroundColor: STATUS_COLORS[tooltipData.status],
                        }}
                      />
                      <span className="font-medium">
                        {STATUS_LABELS[tooltipData.status]}
                      </span>
                      <span className="text-white/60">{tooltipData.count}</span>
                    </div>
                  </TooltipContainer>
                </TooltipWithBounds>
              )}
            </div>
          )
        }}
      </ParentSize>
    </div>
  )
}
