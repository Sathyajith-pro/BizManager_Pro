import Product from "./Product";

/**
 * Central stock adjustments for creating, updating and deleting orders.
 *
 * @param {Object|null} oldOrder - The order before update (null if new order)
 * @param {Object|null} newOrder - The order after update (null if deleted)
 */
export async function adjustStockForOrder(oldOrder, newOrder) {
  try {
    // 1. Restore stock of the old order if it existed and was NOT "Return"
    if (oldOrder && oldOrder.deliveryStatus !== "Return" && oldOrder.items && oldOrder.items.length > 0) {
      for (const item of oldOrder.items) {
        if (!item.itemName) continue;
        await Product.findOneAndUpdate(
          { name: item.itemName.trim() },
          { $inc: { stock: item.quantity } }
        );
      }
    }

    // 2. Deduct stock of the new order if it exists and is NOT "Return"
    if (newOrder && newOrder.deliveryStatus !== "Return" && newOrder.items && newOrder.items.length > 0) {
      for (const item of newOrder.items) {
        if (!item.itemName) continue;
        await Product.findOneAndUpdate(
          { name: item.itemName.trim() },
          { $inc: { stock: -item.quantity } }
        );
      }
    }
  } catch (err) {
    console.error("Error in adjustStockForOrder:", err);
  }
}
