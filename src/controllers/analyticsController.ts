import type { Request, Response } from 'express';
import { prisma } from '../utils/prismaClient';

export async function getDashboardMetrics(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!; // guaranteed by tenantContext middleware

  try {
    // 1. Calculate Total Sales Count (non-cancelled orders)
    const totalSalesCount = await prisma.order.count({
      where: {
        tenantId,
        status: { not: 'CANCELLED' },
      },
    });

    // 2. Calculate Total Revenue (PAID or SHIPPED orders)
    const revenueSumResult = await prisma.order.aggregate({
      where: {
        tenantId,
        status: { in: ['PAID', 'SHIPPED'] },
      },
      _sum: {
        totalAmount: true,
      },
    });
    const totalRevenue = Number(revenueSumResult._sum.totalAmount || 0);

    // 3. Fetch non-cancelled orders from the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const orders = await prisma.order.findMany({
      where: {
        tenantId,
        createdAt: { gte: thirtyDaysAgo },
        status: { not: 'CANCELLED' },
      },
      select: {
        totalAmount: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // 4. Generate a list of all 30 days with 0 sales as default
    const chartDataMap = new Map<string, number>();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const label = `${months[d.getMonth()]} ${String(d.getDate()).padStart(2, '0')}`;
      chartDataMap.set(label, 0);
    }

    // 5. Aggregate order amounts by day label
    for (const order of orders) {
      const d = new Date(order.createdAt);
      const label = `${months[d.getMonth()]} ${String(d.getDate()).padStart(2, '0')}`;
      if (chartDataMap.has(label)) {
        chartDataMap.set(label, chartDataMap.get(label)! + Number(order.totalAmount));
      }
    }

    // 6. Convert map to array
    const chartData = Array.from(chartDataMap.entries()).map(([date, revenue]) => ({
      date,
      revenue: Number(revenue.toFixed(2)),
    }));

    res.status(200).json({
      status: 'success',
      data: {
        totalSalesCount,
        totalRevenue,
        chartData,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to retrieve analytics metrics.',
    });
  }
}
