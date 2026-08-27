import type { Metadata } from "next";

import { CategoriesView } from "@/components/categories/categories-view";
import { getCategoriesWithUsage } from "@/lib/data";

export const metadata: Metadata = {
  title: "Categories · Drawer Inventory",
};

export default async function CategoriesPage() {
  const categories = await getCategoriesWithUsage();
  return <CategoriesView categories={categories} />;
}
