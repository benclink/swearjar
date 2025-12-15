import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Profile {
  id: string;
  display_name: string | null;
  email: string | null;
}

interface MerchantMapping {
  id: string;
  user_id: string | null;
  merchant_pattern: string;
  category: string;
}

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  // Get merchant mappings
  const { data: mappingsData } = await supabase
    .from("merchant_mappings")
    .select("id, user_id, merchant_pattern, category")
    .or(`user_id.eq.${user.id},user_id.is.null`)
    .order("merchant_pattern");

  const mappings = mappingsData as MerchantMapping[] | null;

  // Get user profile
  const { data: profileData } = await supabase
    .from("profiles")
    .select("id, display_name, email")
    .eq("id", user.id)
    .single();

  const profile = profileData as Profile | null;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and merchant mappings
        </p>
      </div>

      {/* Profile Card */}
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Your account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium">{user.email}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Display Name</p>
              <p className="font-medium">{profile?.display_name || "Not set"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Merchant Mappings */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Merchant Mappings</CardTitle>
              <CardDescription>
                Rules for auto-categorizing transactions. Ask the chat assistant to add new mappings.
              </CardDescription>
            </div>
            <Badge variant="secondary">{mappings?.length || 0} mappings</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {mappings && mappings.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-sm text-muted-foreground">
                    <th className="pb-3 font-medium">Merchant Pattern</th>
                    <th className="pb-3 font-medium">Category</th>
                    <th className="pb-3 font-medium">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {mappings.slice(0, 20).map((mapping) => (
                    <tr key={mapping.id} className="border-b last:border-0">
                      <td className="py-3 text-sm font-mono">{mapping.merchant_pattern}</td>
                      <td className="py-3">
                        <Badge variant="outline">{mapping.category}</Badge>
                      </td>
                      <td className="py-3 text-sm text-muted-foreground">
                        {mapping.user_id ? "Custom" : "Global"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {mappings.length > 20 && (
                <p className="text-sm text-muted-foreground mt-4 text-center">
                  Showing first 20 of {mappings.length} mappings
                </p>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No merchant mappings yet.</p>
              <p className="text-sm text-muted-foreground mt-1">
                Try asking: &quot;Learn: Coffee Club should be Dining Out&quot;
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Data Management */}
      <Card>
        <CardHeader>
          <CardTitle>Data Management</CardTitle>
          <CardDescription>Export or manage your financial data</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-4">
          <Button variant="outline">Export Transactions (CSV)</Button>
          <Button variant="outline">Export Budget Report</Button>
        </CardContent>
      </Card>
    </div>
  );
}
