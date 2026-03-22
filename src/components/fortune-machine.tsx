"use client";

import { useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { QRCodeSVG } from "qrcode.react";

type FlowState =
  | { step: "idle" }
  | { step: "requesting" }
  | {
      step: "invoice";
      invoice: string;
      macaroon: string;
      amountSats: number;
    }
  | { step: "paying" }
  | { step: "fortune"; fortune: string; timestamp: string }
  | { step: "error"; message: string };

export function FortuneMachine() {
  const [state, setState] = useState<FlowState>({ step: "idle" });

  const requestFortune = useCallback(async () => {
    setState({ step: "requesting" });

    try {
      const res = await fetch("/api/fortune");

      if (res.status === 402) {
        const data = await res.json();
        setState({
          step: "invoice",
          invoice: data.invoice,
          macaroon: data.macaroon,
          amountSats: data.amountSats,
        });
        return;
      }

      if (res.ok) {
        const data = await res.json();
        setState({ step: "fortune", fortune: data.fortune, timestamp: data.timestamp });
        return;
      }

      setState({ step: "error", message: `Unexpected response: ${res.status}` });
    } catch (e) {
      setState({
        step: "error",
        message: e instanceof Error ? e.message : "Network error",
      });
    }
  }, []);

  const payInvoice = useCallback(async (invoice: string, macaroon: string) => {
    setState({ step: "paying" });

    try {
      if (typeof window !== "undefined" && "webln" in window) {
        const webln = (window as unknown as { webln: { enable: () => Promise<void>; sendPayment: (invoice: string) => Promise<{ preimage: string }> } }).webln;
        await webln.enable();
        const { preimage } = await webln.sendPayment(invoice);

        const res = await fetch("/api/fortune", {
          headers: { Authorization: `L402 ${macaroon}:${preimage}` },
        });

        if (res.ok) {
          const data = await res.json();
          setState({ step: "fortune", fortune: data.fortune, timestamp: data.timestamp });
          return;
        }

        setState({ step: "error", message: `Payment accepted but fortune failed: ${res.status}` });
        return;
      }

      setState({
        step: "invoice",
        invoice,
        macaroon,
        amountSats: 10,
      });
    } catch (e) {
      setState({
        step: "error",
        message: e instanceof Error ? e.message : "Payment failed",
      });
    }
  }, []);

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Fortune Machine</CardTitle>
          <Badge variant="secondary" className="font-mono text-xs">
            10 sats
          </Badge>
        </div>
        <CardDescription>
          {state.step === "idle" && "Request a fortune to start the L402 flow."}
          {state.step === "requesting" && "Requesting..."}
          {state.step === "invoice" && "Invoice ready — pay to reveal your fortune."}
          {state.step === "paying" && "Paying invoice..."}
          {state.step === "fortune" && "Fortune revealed!"}
          {state.step === "error" && "Something went wrong."}
        </CardDescription>
      </CardHeader>

      <Separator />

      <CardContent className="pt-4 space-y-4">
        {/* IDLE */}
        {state.step === "idle" && (
          <Button onClick={requestFortune} className="w-full">
            Get Fortune
          </Button>
        )}

        {/* REQUESTING */}
        {state.step === "requesting" && (
          <div className="space-y-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        )}

        {/* INVOICE — 402 received */}
        {state.step === "invoice" && (
          <div className="space-y-4">
            <div className="rounded-lg border border-border/50 bg-muted/30 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  HTTP 402 — Payment Required
                </span>
                <Badge variant="outline" className="font-mono text-xs">
                  {state.amountSats} sats
                </Badge>
              </div>
              <div className="flex justify-center py-2">
                <div className="rounded-lg bg-white p-3">
                  <QRCodeSVG
                    value={state.invoice.toUpperCase()}
                    size={200}
                    level="M"
                  />
                </div>
              </div>
              <div className="font-mono text-[10px] break-all text-muted-foreground/60 leading-relaxed max-h-16 overflow-y-auto text-center">
                {state.invoice}
              </div>
            </div>

            <div className="space-y-2">
              <Button
                onClick={() => payInvoice(state.invoice, state.macaroon)}
                className="w-full"
              >
                Pay with WebLN
              </Button>
              <Button
                variant="outline"
                className="w-full font-mono text-xs"
                onClick={() => {
                  navigator.clipboard.writeText(state.invoice);
                }}
              >
                Copy Invoice
              </Button>
            </div>
          </div>
        )}

        {/* PAYING */}
        {state.step === "paying" && (
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <p className="text-xs text-muted-foreground text-center">
              Waiting for payment confirmation...
            </p>
          </div>
        )}

        {/* FORTUNE REVEALED */}
        {state.step === "fortune" && (
          <div className="space-y-4">
            <blockquote className="border-l-2 border-primary pl-4 py-2 text-base italic leading-relaxed">
              &ldquo;{state.fortune}&rdquo;
            </blockquote>
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-muted-foreground">
                {new Date(state.timestamp).toLocaleTimeString()}
              </span>
              <Badge className="bg-green-900/30 text-green-400 border-green-800/50">
                Paid
              </Badge>
            </div>
            <Separator />
            <Button
              onClick={() => {
                setState({ step: "idle" });
              }}
              variant="outline"
              className="w-full"
            >
              Another Fortune
            </Button>
          </div>
        )}

        {/* ERROR */}
        {state.step === "error" && (
          <div className="space-y-3">
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3">
              <p className="text-sm text-destructive">{state.message}</p>
            </div>
            <Button
              onClick={() => {
                setState({ step: "idle" });
              }}
              variant="outline"
              className="w-full"
            >
              Try Again
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
