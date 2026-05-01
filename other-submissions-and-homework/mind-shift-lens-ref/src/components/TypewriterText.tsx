import { useState, useEffect } from "react";

interface Props {
  text: string;
  speed?: number;
  className?: string;
  onComplete?: () => void;
  showCursor?: boolean;
}

const TypewriterText = ({ text, speed = 60, className = "", onComplete, showCursor = true }: Props) => {
  const [displayed, setDisplayed] = useState("");
  const [cursorVisible, setCursorVisible] = useState(true);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      if (i < text.length) {
        setDisplayed(text.slice(0, i + 1));
        i++;
      } else {
        clearInterval(interval);
        setDone(true);
        onComplete?.();
        setTimeout(() => setCursorVisible(false), 1000);
      }
    }, speed);
    return () => clearInterval(interval);
  }, [text, speed, onComplete]);

  return (
    <span className={className}>
      {displayed}
      {showCursor && cursorVisible && (
        <span className={`${done ? "animate-blink" : ""} text-primary`}>▌</span>
      )}
    </span>
  );
};

export default TypewriterText;
