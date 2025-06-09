import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "../../../utils/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    // 1. Find the first free computer
    const { data: computers, error: fetchComputerError } = await supabase
      .from("computers")
      .select("id, name, status, person_assigned")
      .eq("status", true)
      .order("id", { ascending: true })
      .limit(1);
    if (fetchComputerError) {
      console.error("Error fetching computers:", fetchComputerError);
      return res.status(500).json({ step: "fetchComputer", error: fetchComputerError.message });
    }
    if (!computers || computers.length === 0) {
      console.warn("No free computers available");
      return res.status(404).json({ step: "fetchComputer", error: "No free computers available" });
    }
    const computer = computers[0];

    // 2. Find the oldest active token (status=true)
    const { data: tokens, error: fetchTokenError } = await supabase
      .from("token")
      .select("id, name, token, status")
      .eq("status", true)
      .order("id", { ascending: true })
      .limit(1);
    if (fetchTokenError) {
      console.error("Error fetching tokens:", fetchTokenError);
      return res.status(500).json({ step: "fetchToken", error: fetchTokenError.message });
    }
    if (!tokens || tokens.length === 0) {
      console.warn("No active tokens available");
      return res.status(404).json({ step: "fetchToken", error: "No active tokens available" });
    }
    const token = tokens[0];

    // 3. Assign the token to the computer
    //    - Update computer: status=false, person_assigned=token.id
    //    - Update token: status=false
    const { error: updateComputerError } = await supabase
      .from("computers")
      .update({ status: false, person_assigned: token.id })
      .eq("id", computer.id);
    if (updateComputerError) {
      console.error("Error updating computer:", updateComputerError);
      return res.status(500).json({ step: "updateComputer", error: updateComputerError.message });
    }
    const { error: updateTokenError } = await supabase
      .from("token")
      .update({ status: false })
      .eq("id", token.id);
    if (updateTokenError) {
      console.error("Error updating token:", updateTokenError);
      return res.status(500).json({ step: "updateToken", error: updateTokenError.message });
    }

    return res.status(200).json({ assigned: { computer: { ...computer, status: false, person_assigned: token.id }, token: { ...token, status: false } } });
  } catch (err) {
    console.error("Unexpected error in auto-assign API:", err);
    let errorMsg = "Unexpected error";
    if (typeof err === "object" && err !== null && "message" in err) {
      errorMsg = (err as { message?: string }).message || errorMsg;
    }
    return res.status(500).json({ step: "unexpected", error: errorMsg });
  }
} 