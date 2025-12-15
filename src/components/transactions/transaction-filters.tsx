"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Search, X, AlertCircle } from "lucide-react";
import { useState, useEffect } from "react";

interface Category {
  name: string;
  classification: string;
}

interface TransactionFiltersProps {
  categories: Category[];
}

export function TransactionFilters({ categories }: TransactionFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [category, setCategory] = useState(searchParams.get("category") || "");
  const [classification, setClassification] = useState(searchParams.get("classification") || "");
  const [startDate, setStartDate] = useState(searchParams.get("startDate") || "");
  const [endDate, setEndDate] = useState(searchParams.get("endDate") || "");
  const [needsReview, setNeedsReview] = useState(searchParams.get("needsReview") === "true");

  const applyFilters = () => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (category) params.set("category", category);
    if (classification) params.set("classification", classification);
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    if (needsReview) params.set("needsReview", "true");
    params.set("page", "1");
    router.push(`?${params.toString()}`);
  };

  const clearFilters = () => {
    setSearch("");
    setCategory("");
    setClassification("");
    setStartDate("");
    setEndDate("");
    setNeedsReview(false);
    router.push("/transactions");
  };

  const hasFilters = search || category || classification || startDate || endDate || needsReview;

  // Group categories by classification
  const groupedCategories = categories.reduce((acc, cat) => {
    if (!acc[cat.classification]) {
      acc[cat.classification] = [];
    }
    acc[cat.classification].push(cat.name);
    return acc;
  }, {} as Record<string, string[]>);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Search */}
        <div className="space-y-2">
          <Label htmlFor="search">Search</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="search"
              placeholder="Search transactions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
            />
          </div>
        </div>

        {/* Classification */}
        <div className="space-y-2">
          <Label htmlFor="classification">Classification</Label>
          <select
            id="classification"
            value={classification}
            onChange={(e) => setClassification(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">All classifications</option>
            <option value="Essential">Essential</option>
            <option value="Discretionary">Discretionary</option>
            <option value="Non-Spending">Non-Spending</option>
            <option value="Income">Income</option>
          </select>
        </div>

        {/* Category */}
        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">All categories</option>
            {Object.entries(groupedCategories).map(([classif, cats]) => (
              <optgroup key={classif} label={classif}>
                {cats.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {/* Needs Review */}
        <div className="space-y-2">
          <Label>Quick Filters</Label>
          <Button
            variant={needsReview ? "default" : "outline"}
            className="w-full justify-start"
            onClick={() => setNeedsReview(!needsReview)}
          >
            <AlertCircle className="h-4 w-4 mr-2" />
            Needs Review
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Date Range */}
        <div className="space-y-2">
          <Label htmlFor="startDate">From Date</Label>
          <Input
            id="startDate"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="endDate">To Date</Label>
          <Input
            id="endDate"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>

        {/* Actions */}
        <div className="space-y-2 md:col-span-2 flex items-end gap-2">
          <Button onClick={applyFilters} className="flex-1">
            Apply Filters
          </Button>
          {hasFilters && (
            <Button variant="outline" onClick={clearFilters}>
              <X className="h-4 w-4 mr-2" />
              Clear
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
