declare module 'praytime' {
  interface PrayerTimesResult {
    fajr: string
    sunrise: string
    dhuhr: string
    asr: string
    sunset: string
    maghrib: string
    isha: string
    midnight: string
  }

  interface PrayTimeParams {
    fajr?: number | string
    dhuhr?: number | string
    asr?: 'Standard' | 'Hanafi' | number
    maghrib?: number | string
    isha?: number | string
    midnight?: 'Standard' | 'Jafari'
    highLats?: 'None' | 'NightMiddle' | 'OneSeventh' | 'AngleBased'
  }

  class PrayTime {
    constructor(method?: string)

    method(method: string): PrayTime
    location(coordinates: [number, number, number?]): PrayTime
    timezone(timezone: string): PrayTime
    utcOffset(offset: number | string): PrayTime
    format(format: '24h' | '12h' | '12H' | 'x' | 'X'): PrayTime
    adjust(params: PrayTimeParams): PrayTime
    tune(offsets: Partial<PrayerTimesResult>): PrayTime
    round(method: 'up' | 'down' | 'nearest' | 'none'): PrayTime
    getTimes(date?: Date | number[] | number): PrayerTimesResult

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    methods: Record<string, any>
  }

  export { PrayTime }
  export default PrayTime
}
