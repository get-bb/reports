// Every specifier in RUNTIME_SLOT_BY_SPECIFIER (packages/plugin-build/src/build-plugin-app.ts)
import * as React from "react";
import * as ReactDom from "react-dom";
import * as ReactDomClient from "react-dom/client";
import * as PierreDiffs from "@pierre/diffs";
import * as PierreDiffsReact from "@pierre/diffs/react";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import * as ContextMenu from "@radix-ui/react-context-menu";
import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as HoverCard from "@radix-ui/react-hover-card";
import * as Menubar from "@radix-ui/react-menubar";
import * as NavigationMenu from "@radix-ui/react-navigation-menu";
import * as Popover from "@radix-ui/react-popover";
import * as Select from "@radix-ui/react-select";
import * as Tooltip from "@radix-ui/react-tooltip";
import * as Sonner from "sonner";
import * as Vaul from "vaul";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { cva } from "class-variance-authority";
export const all = [
  React,
  ReactDom,
  ReactDomClient,
  PierreDiffs,
  PierreDiffsReact,
  AlertDialog,
  ContextMenu,
  Dialog,
  DropdownMenu,
  HoverCard,
  Menubar,
  NavigationMenu,
  Popover,
  Select,
  Tooltip,
  Sonner,
  Vaul,
  clsx,
  twMerge,
  cva,
];
