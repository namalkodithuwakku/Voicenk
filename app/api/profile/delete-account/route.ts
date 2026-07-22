import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function DELETE() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "You must be signed in to delete this account." },
        { status: 401 },
      );
    }

    const secretKey =
      process.env.SUPABASE_SECRET_KEY?.trim() ||
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

    if (!secretKey) {
      return NextResponse.json(
        {
          error:
            "Account deletion is not configured. Add SUPABASE_SECRET_KEY to the server environment.",
        },
        { status: 500 },
      );
    }

    const { url } = getSupabaseConfig();
    const admin = createAdminClient(url, secretKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    async function listOwnedVoiceFiles(rootPath: string) {
      const files: string[] = [];
      const folders = [rootPath];

      while (folders.length > 0) {
        const currentPath = folders.pop();

        if (!currentPath) continue;

        let offset = 0;

        while (true) {
          const { data, error } = await admin.storage
            .from("voice-messages")
            .list(currentPath, {
              limit: 100,
              offset,
              sortBy: {
                column: "name",
                order: "asc",
              },
            });

          if (error) {
            if (error.message.toLowerCase().includes("not found")) {
              break;
            }

            throw error;
          }

          const entries = data ?? [];

          for (const entry of entries) {
            const fullPath = `${currentPath}/${entry.name}`;

            if (entry.id) {
              files.push(fullPath);
            } else {
              folders.push(fullPath);
            }
          }

          if (entries.length < 100) {
            break;
          }

          offset += entries.length;
        }
      }

      return files;
    }

    const ownedFiles = await listOwnedVoiceFiles(user.id);

    if (ownedFiles.length > 0) {
      const { error: removeError } = await admin.storage
        .from("voice-messages")
        .remove(ownedFiles);

      if (removeError) {
        throw new Error(
          `Could not remove voice files: ${removeError.message}`,
        );
      }
    }

    const { error: deleteError } =
      await admin.auth.admin.deleteUser(user.id);

    if (deleteError) {
      throw new Error(deleteError.message);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Account deletion failed.",
      },
      { status: 500 },
    );
  }
}
