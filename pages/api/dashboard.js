import dbConnect from "../../lib/dbConnect";
import Order from "../../lib/Order";
import Expense from "../../lib/Expense";
import { requireRole } from "../../lib/auth";

export default async function handler(req, res) {
  await dbConnect();

  // Require admin role
  const auth = requireRole(req, ["admin"]);
  if (!auth.authorized) {
    return res.status(auth.authenticated ? 403 : 401).json({ error: "Access denied. Admin role required." });
  }

  if (req.method === "GET") {
    try {
      const orders = await Order.find({});
      const expenses = await Expense.find({});

      // Calculations
      let totalSales = 0;
      let totalRevenue = 0;
      let pendingDeliveryVal = 0;
      let deliveryCounts = { Pending: 0, Delivered: 0, Return: 0, Completed: 0 };
      let cashCounts = { Yes: 0, No: 0 };
      let cashValue = { Yes: 0, No: 0 };

      orders.forEach((o) => {
        const price = o.totalPrice || o.price || 0;
        totalSales += price;

        const status = o.deliveryStatus || o.status || "Pending";
        if (deliveryCounts[status] !== undefined) {
          deliveryCounts[status]++;
        } else {
          if (o.status === "Approved") {
            deliveryCounts.Completed++;
          } else {
            deliveryCounts.Pending++;
          }
        }

        const cash = o.cashReceived || (o.status === "Approved" ? "Yes" : "No");
        if (cash === "Yes") {
          cashCounts.Yes++;
          cashValue.Yes += price;
        } else {
          cashCounts.No++;
          cashValue.No += price;
        }

        if (cash === "Yes" || status === "Delivered" || status === "Completed" || o.status === "Approved") {
          totalRevenue += price;
        } else {
          pendingDeliveryVal += price;
        }
      });

      const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
      const netProfit = totalRevenue - totalExpenses;

      return res.status(200).json({
        totalSales,
        totalRevenue,
        pendingDeliveryVal,
        totalExpenses,
        netProfit,
        deliveryCounts,
        cashCounts,
        cashValue,
        orderCount: orders.length,
        expenseCount: expenses.length,
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Failed to calculate dashboard statistics." });
    }
  }

  res.setHeader("Allow", ["GET"]);
  return res.status(405).json({ error: `Method ${req.method} not allowed.` });
}
