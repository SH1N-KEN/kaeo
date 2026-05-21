import React from 'react';
import { motion } from 'framer-motion';

interface AnimatedGroupProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
  staggerDelay?: number;
  variant?: 'fade' | 'slide' | 'scale';
}

export const AnimatedGroup: React.FC<AnimatedGroupProps> = ({
  children,
  className = '',
  delay = 0,
  duration = 0.5,
  staggerDelay = 0.1,
  variant = 'slide'
}) => {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        delayChildren: delay,
        staggerChildren: staggerDelay
      }
    }
  };

  const getChildVariants = () => {
    switch (variant) {
      case 'fade':
        return {
          hidden: { opacity: 0 },
          visible: { 
            opacity: 1, 
            transition: { duration } 
          }
        };
      case 'scale':
        return {
          hidden: { opacity: 0, scale: 0.95 },
          visible: { 
            opacity: 1, 
            scale: 1, 
            transition: { duration, type: 'spring' as const, stiffness: 100 } 
          }
        };
      case 'slide':
      default:
        return {
          hidden: { opacity: 0, y: 15 },
          visible: { 
            opacity: 1, 
            y: 0, 
            transition: { duration, type: 'spring' as const, damping: 20, stiffness: 100 } 
          }
        };
    }
  };

  const childVariants = getChildVariants();

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-50px' }}
      className={className}
    >
      {React.Children.map(children, (child) => {
        if (!React.isValidElement(child)) return null;
        return (
          <motion.div variants={childVariants}>
            {child}
          </motion.div>
        );
      })}
    </motion.div>
  );
};
