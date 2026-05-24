import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Transaction } from '@/lib/data'

interface PeakHourData {
  hour: string
  count: number
}

export function usePeakHours(transactions: Transaction[] = []) {
  const [data, setData] = useState<PeakHourData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const calculatePeakHours = (txns: Transaction[]): PeakHourData[] => {
    // Determine "today" based on the most recent transaction in the dataset if present, 
    // to ensure mock data still shows up in the chart.
    const latestTxnDateStr = txns.length > 0 
      ? [...txns].sort((a, b) => new Date(b.arrivalDateTime).getTime() - new Date(a.arrivalDateTime).getTime())[0].arrivalDateTime.split(' ')[0]
      : new Date().toISOString().split('T')[0];

    // Filter transactions for "today" only, exclude Voided
    const todayTxns = txns.filter((txn) => {
      if (txn.status === 'Voided') return false
      const txnDate = txn.arrivalDateTime.split(' ')[0]
      return txnDate === latestTxnDateStr
    })

    // Initialize hours 8AM to 8PM
    const hours = [
      '8AM', '9AM', '10AM', '11AM', '12PM',
      '1PM', '2PM', '3PM', '4PM', '5PM', '6PM', '7PM', '8PM'
    ]
    
    const hourCounts: Record<string, number> = {}
    hours.forEach(h => hourCounts[h] = 0)

    // Count transactions per hour
    todayTxns.forEach((txn) => {
      const timePart = txn.arrivalDateTime.split(' ')[1] // HH:MM
      if (!timePart) return
      
      const hour = parseInt(timePart.split(':')[0], 10)
      
      // Map 24-hour to 12-hour format
      let hourLabel = ''
      if (hour === 0) hourLabel = '12AM'
      else if (hour < 12) hourLabel = `${hour}AM`
      else if (hour === 12) hourLabel = '12PM'
      else hourLabel = `${hour - 12}PM`

      // Only count if within 8AM-8PM range
      if (hourCounts[hourLabel] !== undefined) {
        hourCounts[hourLabel]++
      }
    })

    return hours.map(hour => ({
      hour,
      count: hourCounts[hour]
    }))
  }

  useEffect(() => {
    let mounted = true
    let subscription: any = null

    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)

        // Try to fetch from Supabase
        const today = new Date()
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0)
        const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59)

        const { data: supabaseData, error: supabaseError } = await supabase
          .from('transactions')
          .select('*')
          .gte('arrival_time', startOfDay.toISOString())
          .lte('arrival_time', endOfDay.toISOString())
          .neq('status', 'Voided')

        if (supabaseError) throw supabaseError

        if (supabaseData && mounted) {
          // Map Supabase data to Transaction format
          const mappedTxns: Transaction[] = supabaseData.map((row: any) => ({
            id: row.id,
            ticketId: row.ticket_id,
            customerName: row.customer_name,
            phone: row.phone_number || '',
            arrivalDateTime: new Date(row.arrival_time).toISOString().slice(0, 16).replace('T', ' '),
            dropOffDate: new Date(row.arrival_time).toISOString().split('T')[0],
            washType: row.wash_type,
            weight: row.weight_kg || 0,
            fee: row.fee,
            status: row.status,
            paymentStatus: row.payment_status,
            addOns: row.addons || [],
            washInstructions: row.special_instructions,
            eta: row.eta,
          }))

          setData(calculatePeakHours(mappedTxns))
        }
      } catch (err) {
        // Fallback to local transactions
        console.warn('Supabase not configured, using local data:', err)
        if (mounted) {
          setData(calculatePeakHours(transactions))
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    fetchData()

    // Set up real-time subscription
    try {
      subscription = supabase
        .channel('transactions_changes')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'transactions'
          },
          () => {
            // Refetch data when new transaction is inserted
            fetchData()
          }
        )
        .subscribe()
    } catch (err) {
      console.warn('Real-time subscription not available:', err)
    }

    return () => {
      mounted = false
      if (subscription) {
        subscription.unsubscribe()
      }
    }
  }, [transactions])

  return { data, loading, error }
}
