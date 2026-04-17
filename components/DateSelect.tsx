import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import BlurCircle from "./BlurCircle";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";

type DateSelectProps = {
  dateTime: Date;
};

const DateSelect = ({ dateTime }: DateSelectProps) => {
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<Date | null>(null);

  const dates = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(dateTime);
      d.setDate(d.getDate() + offset + i);
      return d;
    });
  }, [dateTime, offset]);

  const handleBookNow = () => {
    if (!selected) {
      toast.error("You must select a date");
      return;
    }
  };

  return (
    <div id="dateSelect" className="pt-30">
      <div className="flex flex-col md:flex-row items-center justify-between gap-10 relative p-8 bg-red-700/10 border border-red-700/20 rounded-lg">
        <BlurCircle top="-100px" left="-100px" />
        <BlurCircle top="100px" left="0px" />
        <div>
          <p className="text-lg font-semibold">Choose Date</p>
          <div className="flex items-center gap-6 text-sm mt-5">
            <button onClick={() => setOffset((prev) => prev - 7)} aria-label="Previous dates" className="cursor-pointer">
              <ChevronLeftIcon width={28} />
            </button>

            <span className="grid grid-cols-3 md:flex flex-wrap md:max-w-lg gap-4">
              {dates.map((d) => {
                const key = d.toISOString();
                const isSelected = selected?.getTime() === d.getTime();

                return (
                  <button key={key} onClick={() => setSelected(d)} className={`flex flex-col items-center justify-center h-14 w-14 aspect-square rounded cursor-pointer ${isSelected ? "bg-red-700 text-white" : "border border-red-700/70"}`}>
                    <span>{d.getDate()}</span>
                    <span>{d.toLocaleDateString("en-US", { month: "short" })}</span>
                  </button>
                );
              })}
            </span>

            <button onClick={() => setOffset((prev) => prev + 7)} aria-label="Next dates" className="cursor-pointer">
              <ChevronRightIcon width={28} />
            </button>
          </div>
        </div>

        <button onClick={handleBookNow} className="bg-red-700 text-white px-8 py-2 mt-6 rounded hover:bg-red-700/90 transition-all cursor-pointer">
          Book Now
        </button>
      </div>
    </div>
  );
};

export default DateSelect;