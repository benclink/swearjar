import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExportButtons } from "@/components/settings/export-buttons";

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
    <div className="p-6 lg:p-10 space-y-10 max-w-7xl mx-auto">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      </header>

      {/* Profile */}
      <section>
        <h2 className="text-xs text-muted-foreground uppercase tracking-wider mb-6">Account</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 lg:gap-10">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Email</p>
            <p>{user.email}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Display Name</p>
            <p>{profile?.display_name || "—"}</p>
          </div>
        </div>
      </section>

      {/* Merchant Mappings */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xs text-muted-foreground uppercase tracking-wider">
            Merchant Mappings
          </h2>
          <span className="text-sm text-muted-foreground">{mappings?.length || 0} rules</span>
        </div>

        {mappings && mappings.length > 0 ? (
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="p-4 font-medium">Pattern</th>
                    <th className="p-4 font-medium">Category</th>
                    <th className="p-4 font-medium">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {mappings.slice(0, 20).map((mapping) => (
                    <tr key={mapping.id} className="border-b last:border-0">
                      <td className="p-4 font-mono text-xs">{mapping.merchant_pattern}</td>
                      <td className="p-4">{mapping.category}</td>
                      <td className="p-4 text-muted-foreground">
                        {mapping.user_id ? "Custom" : "Global"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {mappings.length > 20 && (
                <p className="text-xs text-muted-foreground p-4 text-center border-t">
                  Showing 20 of {mappings.length}
                </p>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-sm text-muted-foreground">No merchant mappings yet.</p>
              <p className="text-xs text-muted-foreground mt-1">
                Ask the assistant: &quot;Learn: Coffee Club should be Dining Out&quot;
              </p>
            </CardContent>
          </Card>
        )}
      </section>

      {/* Data Management */}
      <section>
        <h2 className="text-xs text-muted-foreground uppercase tracking-wider mb-6">Data</h2>
        <Card>
          <CardHeader>
            <CardTitle>Export</CardTitle>
          </CardHeader>
          <CardContent>
            <ExportButtons />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
