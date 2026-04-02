import React from 'react'
import { useState , useEffect } from 'react';

export default function SlideBar({min = 0,max = 100,step = 10,initialData = 50,title = "unknown",onValueChange = () => {} }) {
  const [value, setValue] = useState(initialData); // Default value
  useEffect(() => {
    onValueChange(value); // Propagate the change to the parent component
  }, [value]);

  const handleChange = (e) => {
    // console.log(e)
    setValue(parseFloat(e.target.value));
  };
  return (
    <div> 
    <label htmlFor="steps-range" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">
        {title}
    </label>
    <input
        id="steps-range"
        onChange={handleChange}
        type="range"
        min={min}
        max={max}
        value={value}
        step={step}
        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
    />
    </div>

  )
}
