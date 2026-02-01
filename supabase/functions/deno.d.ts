declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

declare module "https://esm.sh/@supabase/supabase-js@2" {
  export const createClient: any;
}
