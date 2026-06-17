"use client";

import { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold, Italic, Strikethrough,
  Heading2, Heading3,
  List, ListOrdered, Quote,
  Link as LinkIcon, Link2Off,
  Minus, Eraser,
} from "lucide-react";
import { cn } from "@/lib/cn";

type Props = {
  /** Field name — TipTap output goes into a hidden <input> with this name. */
  name: string;
  /** Initial HTML content. Server-sanitised before display. */
  defaultValue?: string | null;
  /** Placeholder shown when empty. */
  placeholder?: string;
  /** Max length (counts plain-text characters, not HTML). */
  maxLength?: number;
  /** Form-level disabled, e.g. while submitting. */
  disabled?: boolean;
};

/**
 * Rich-text editor for product description / news body.
 *
 * Output goes into a hidden <input name={name}> on every keystroke so
 * the surrounding <form> picks it up via plain FormData — no extra
 * controlled-state wiring needed at the form level. The server action
 * runs `sanitizeRichText()` on the value before persisting, so we don't
 * trust client output even from a logged-in admin.
 *
 * Styling note: the rendered content uses our `.prose-judy` class on
 * the public site, but here in the admin editor we use a slightly
 * tighter `.prose-editor` so editing feels compact. NO color buttons —
 * admins cannot set colors; site CSS owns that.
 */
export function RichTextEditor({
  name,
  defaultValue,
  placeholder,
  maxLength,
  disabled,
}: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        // We don't expose code-block in the toolbar — strip the extension
        // so admin paste from devtools doesn't sneak it in either.
        codeBlock: false,
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        protocols: ["http", "https", "mailto"],
        HTMLAttributes: {
          rel: "noopener noreferrer",
          target: "_blank",
        },
      }),
      Placeholder.configure({
        placeholder: placeholder ?? "Type here…",
        emptyEditorClass: "is-editor-empty",
      }),
    ],
    content: defaultValue ?? "",
    editable: !disabled,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: cn(
          "prose-editor focus:outline-none min-h-[140px] px-3 py-2.5 text-[14px]",
          // Lock typography to site fonts — admins can't override.
          "font-sans text-fg-light",
        ),
      },
    },
  });

  // Sync editor → hidden input so plain HTML form submission picks it up.
  useEffect(() => {
    if (!editor) return;
    const input = document.getElementsByName(name)[0] as HTMLInputElement | undefined;
    if (input) input.value = editor.getHTML();
    const handler = () => {
      const el = document.getElementsByName(name)[0] as HTMLInputElement | undefined;
      if (el) el.value = editor.getHTML();
    };
    editor.on("update", handler);
    return () => {
      editor.off("update", handler);
    };
  }, [editor, name]);

  if (!editor) {
    return (
      <div className="rounded-lg border border-line-light bg-paper-2 px-3 py-2 text-[12px] text-fg-light-mute">
        Loading editor…
      </div>
    );
  }

  const charCount = editor.getText().length;
  const overLimit = maxLength != null && charCount > maxLength;

  return (
    <div className={cn("space-y-1.5", disabled && "opacity-60")}>
      <Toolbar editor={editor} />
      <div
        className={cn(
          "rounded-lg border bg-paper-2 transition-colors focus-within:border-pink-400 focus-within:ring-4 focus-within:ring-pink-400/15",
          overLimit ? "border-pink-500/50" : "border-line-light",
        )}
      >
        <EditorContent editor={editor} />
      </div>
      <input type="hidden" name={name} defaultValue={editor.getHTML()} />
      {maxLength != null && (
        <p
          className={cn(
            "text-right font-mono text-[10px]",
            overLimit ? "text-pink-500" : "text-fg-light-mute",
          )}
        >
          {charCount} / {maxLength}
        </p>
      )}
    </div>
  );
}

// ── Toolbar ────────────────────────────────────────────────────

function Toolbar({ editor }: { editor: ReturnType<typeof useEditor> & {} }) {
  if (!editor) return null;

  const setLink = () => {
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL (http / https / mailto)", previous ?? "");
    if (url === null) return; // cancelled
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    if (!/^(https?:|mailto:)/i.test(url)) {
      // ignore unsafe schemes silently — server would strip them anyway.
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  return (
    <div className="flex flex-wrap items-center gap-0.5 rounded-lg border border-line-light bg-paper-2 p-1">
      <Btn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Bold (Ctrl/Cmd+B)">
        <Bold size={14} strokeWidth={2.5} />
      </Btn>
      <Btn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Italic (Ctrl/Cmd+I)">
        <Italic size={14} strokeWidth={2.5} />
      </Btn>
      <Btn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} title="Strikethrough">
        <Strikethrough size={14} strokeWidth={2.5} />
      </Btn>
      <Divider />
      <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} title="Heading 2">
        <Heading2 size={14} strokeWidth={2.5} />
      </Btn>
      <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })} title="Heading 3">
        <Heading3 size={14} strokeWidth={2.5} />
      </Btn>
      <Divider />
      <Btn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Bulleted list">
        <List size={14} strokeWidth={2.5} />
      </Btn>
      <Btn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Numbered list">
        <ListOrdered size={14} strokeWidth={2.5} />
      </Btn>
      <Btn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} title="Quote">
        <Quote size={14} strokeWidth={2.5} />
      </Btn>
      <Divider />
      <Btn onClick={setLink} active={editor.isActive("link")} title="Insert / edit link">
        <LinkIcon size={14} strokeWidth={2.5} />
      </Btn>
      {editor.isActive("link") && (
        <Btn onClick={() => editor.chain().focus().unsetLink().run()} title="Remove link">
          <Link2Off size={14} strokeWidth={2.5} />
        </Btn>
      )}
      <Btn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal rule">
        <Minus size={14} strokeWidth={2.5} />
      </Btn>
      <Divider />
      <Btn
        onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
        title="Clear formatting"
      >
        <Eraser size={14} strokeWidth={2.5} />
      </Btn>
    </div>
  );
}

function Btn({
  onClick, active, title, children,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={cn(
        "grid h-7 w-7 place-items-center rounded transition-colors",
        active
          ? "bg-pink-500/15 text-pink-400"
          : "text-fg-light-soft hover:bg-paper-3 hover:text-fg-light",
      )}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span aria-hidden className="mx-0.5 h-5 w-px bg-line-light" />;
}
