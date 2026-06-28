"use client"
import dynamic from "next/dynamic"

const DashboardCharts = dynamic(() => import("./DashboardCharts"), { ssr: false })

export default DashboardCharts
